// netlify/edge-functions/proxy-handler.ts
import type { Context } from "@netlify/edge-functions";

// 定义你的代理规则：路径前缀 => 目标基础 URL
const PROXY_CONFIG = {
  // API 服务器
  "/discord": "https://discord.com/api",
  "/telegram": "https://api.telegram.org",
  "/openai": "https://api.openai.com",
  "/claude": "https://api.anthropic.com",
  "/gemini": "https://generativelanguage.googleapis.com",
  "/meta": "https://www.meta.ai/api",
  "/groq": "https://api.groq.com/openai",
  "/xai": "https://api.x.ai",
  "/cohere": "https://api.cohere.ai",
  "/huggingface": "https://api-inference.huggingface.co",
  "/together": "https://api.together.xyz",
  "/novita": "https://api.novita.ai",
  "/portkey": "https://api.portkey.ai",
  "/fireworks": "https://api.fireworks.ai",
  "/openrouter": "https://openrouter.ai/api",
  // 任意网址
  "/hexo": "https://hexo-gally.vercel.app", 
  "/hexo2": "https://hexo-987.pages.dev",
  "/halo": "https://blog.gally.dpdns.org",
  "/kuma": "https://kuma.gally.dpdns.org",
  "/hf": "https://huggingface.co",
  "/tv": "https://tv.gally.ddns-ip.net",
  "/news": "https://newsnow-ahm.pages.dev"
};

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // 查找匹配的代理配置
  let targetBaseUrl: string | null = null;
  let matchedPrefix: string | null = null;

  // 倒序遍历，以便更具体的路径（如 /api/v2）优先于 /api
  const prefixes = Object.keys(PROXY_CONFIG).sort().reverse();

  for (const prefix of prefixes) {
    // 确保匹配的是完整的前缀部分，避免 /apixyz 匹配 /api
    if (path === prefix || path.startsWith(prefix + '/')) {
      targetBaseUrl = PROXY_CONFIG[prefix as keyof typeof PROXY_CONFIG];
      matchedPrefix = prefix;
      break; // 找到第一个（最具体的）匹配就停止
    }
  }

  // 如果找到了匹配的规则
  if (targetBaseUrl && matchedPrefix) {
    // 构造目标 URL
    const remainingPath = path.substring(matchedPrefix.length);
    const targetUrlString = targetBaseUrl.replace(/\/$/, '') + remainingPath;
    const targetUrl = new URL(targetUrlString);

    // 继承原始请求的查询参数
    targetUrl.search = url.search;

    context.log(`Proxying "${path}" to "${targetUrl.toString()}"`);

    try {
      // 重要：创建一个新的 Request 对象以避免潜在问题
      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual', // 防止 fetch 自动处理重定向
      });

      // （可选）设置 Host 头以匹配目标主机
      proxyRequest.headers.set("Host", targetUrl.host);
      // （可选）添加 X-Forwarded-For 头部
      // const clientIp = context.ip || request.headers.get('x-nf-client-connection-ip');
      // if (clientIp) {
      //   proxyRequest.headers.set('X-Forwarded-For', clientIp);
      // }
      // proxyRequest.headers.set('X-Forwarded-Host', url.host);
      // proxyRequest.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      const response = await fetch(proxyRequest);

      // 如果目标服务器返回重定向，需要构造正确的重定向URL
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const location = response.headers.get('location')!;
          const redirectedUrl = new URL(location, targetUrl); // 解析相对或绝对 Location

          // 如果重定向回代理源本身，则需要重写为原始主机名下的路径
          if (redirectedUrl.origin === targetUrl.origin) {
              const newLocation = url.origin + matchedPrefix + redirectedUrl.pathname + redirectedUrl.search;
              context.log(`Rewriting redirect from ${location} to ${newLocation}`);
              response.headers.set('Location', newLocation);
          } else {
              // 如果重定向到外部域，则直接使用
              context.log(`Proxying redirect to external location: ${location}`);
          }
      }

      return response;

    } catch (error) {
      context.log("Error fetching target URL:", error);
      return new Response("Proxy request failed", { status: 502 });
    }
  }

  // 如果没有匹配的代理规则，则不处理此请求，交由 Netlify 的其他规则处理
  // context.log(`No proxy rule matched for "${path}". Passing through.`);
  return; // 或者 return undefined;
}; 