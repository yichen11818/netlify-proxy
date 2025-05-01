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

// 需要修复路径的内容类型
const HTML_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'text/xml'
];

// 可能需要修复路径的 CSS 内容类型
const CSS_CONTENT_TYPES = [
  'text/css'
];

export default async (request: Request, context: Context) => {
  // 处理 CORS 预检请求 (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        "Access-Control-Max-Age": "86400", // 24小时缓存预检响应
        "Cache-Control": "public, max-age=86400"
      }
    });
  }

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

      // 设置 Host 头以匹配目标主机
      proxyRequest.headers.set("Host", targetUrl.host);
      
      // 添加常用代理头
      const clientIp = context.ip || request.headers.get('x-nf-client-connection-ip') || "";
      proxyRequest.headers.set('X-Forwarded-For', clientIp);
      proxyRequest.headers.set('X-Forwarded-Host', url.host);
      proxyRequest.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
      
      // 确保 accept-encoding 不会导致压缩响应，这样我们才能修改内容
      proxyRequest.headers.delete('accept-encoding');
      
      // 发起代理请求
      const response = await fetch(proxyRequest);
      
      // 获取内容类型
      const contentType = response.headers.get('content-type') || '';
      
      // 创建新的响应对象，以便我们可以修改头部
      let newResponse: Response;
      
      // 对于 HTML 和 CSS 内容，我们需要修改文件内容中的 URL 引用
      if (HTML_CONTENT_TYPES.some(type => contentType.includes(type)) || 
          CSS_CONTENT_TYPES.some(type => contentType.includes(type))) {
        
        // 克隆响应以获取其内容
        const clonedResponse = response.clone();
        let content = await clonedResponse.text();
        
        // 目标网站的域名和协议
        const targetDomain = targetUrl.host;
        const targetOrigin = targetUrl.origin;
        const targetPathBase = targetUrl.pathname.substring(0, targetUrl.pathname.lastIndexOf('/') + 1);
        
        // 替换 HTML/CSS 中的绝对 URL
        if (HTML_CONTENT_TYPES.some(type => contentType.includes(type))) {
          // 替换 HTML 中的链接、脚本和图片引用
          
          // 1. 替换以协议开头的绝对路径 (http:// 或 https://)
          content = content.replace(
            new RegExp(`(href|src|action)=["']https?://${targetDomain}(/[^"']*?)["']`, 'gi'),
            `$1="${url.origin}${matchedPrefix}$2"`
          );
          
          // 2. 替换以 // 开头的协议相对路径
          content = content.replace(
            new RegExp(`(href|src|action)=["']//${targetDomain}(/[^"']*?)["']`, 'gi'),
            `$1="${url.origin}${matchedPrefix}$2"`
          );
          
          // 3. 替换以根目录 / 开头的路径
          content = content.replace(
            new RegExp(`(href|src|action)=["'](/[^"']*?)["']`, 'gi'),
            `$1="${url.origin}${matchedPrefix}$2"`
          );
          
          // 4. 替换 CSS 中的 url() 引用
          content = content.replace(
            new RegExp(`url\\(['"]?https?://${targetDomain}(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
          
          // 5. 替换 CSS 中 url(//...) 的引用
          content = content.replace(
            new RegExp(`url\\(['"]?//${targetDomain}(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
          
          // 6. 替换 CSS 中 url(/...) 根目录引用
          content = content.replace(
            new RegExp(`url\\(['"]?(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
          
          // 7. 处理 <base> 标签
          content = content.replace(
            new RegExp(`<base[^>]*href=["']https?://${targetDomain}(?:/[^"']*?)?["'][^>]*>`, 'gi'),
            `<base href="${url.origin}${matchedPrefix}/">`
          );
          
          // 8. 处理相对路径的修正 (不以 / 或 http:// 开头的)
          // 对于这些路径，我们需要考虑当前请求路径的目录层级
          
          // 9. 处理可能的 JSON 资源路径
          content = content.replace(
            new RegExp(`"(url|path|endpoint)"\\s*:\\s*"https?://${targetDomain}(/[^"]*?)"`, 'gi'),
            `"$1":"${url.origin}${matchedPrefix}$2"`
          );
          
          // 10. 处理可能的内联 JavaScript 中的路径
          content = content.replace(
            new RegExp(`['"]https?://${targetDomain}(/[^"']*?)['"]`, 'gi'),
            `"${url.origin}${matchedPrefix}$1"`
          );
        }
        
        // 对于 CSS 文件，修复 URL 引用
        if (CSS_CONTENT_TYPES.some(type => contentType.includes(type))) {
          // 1. 替换绝对路径 url(http://...)
          content = content.replace(
            new RegExp(`url\\(['"]?https?://${targetDomain}(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
          
          // 2. 替换协议相对路径 url(//...)
          content = content.replace(
            new RegExp(`url\\(['"]?//${targetDomain}(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
          
          // 3. 替换根目录相对路径 url(/...)
          content = content.replace(
            new RegExp(`url\\(['"]?(/[^)'"]*?)['"]?\\)`, 'gi'),
            `url(${url.origin}${matchedPrefix}$1)`
          );
        }
        
        // 创建新的响应对象，包含修改后的内容
        newResponse = new Response(content, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } else {
        // 对于非 HTML/CSS 内容，直接使用原始响应体
        newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
      
      // 添加 CORS 头
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
      // 移除可能导致问题的安全头部
      newResponse.headers.delete('Content-Security-Policy');
      newResponse.headers.delete('X-Frame-Options');
      newResponse.headers.delete('X-Content-Type-Options');
      
      // 确保不缓存可能包含动态内容的响应
      if (HTML_CONTENT_TYPES.some(type => contentType.includes(type))) {
        newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        newResponse.headers.set('Pragma', 'no-cache');
        newResponse.headers.set('Expires', '0');
      }
      
      // 如果目标服务器返回重定向，需要构造正确的重定向URL
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          const location = response.headers.get('location')!;
          const redirectedUrl = new URL(location, targetUrl); // 解析相对或绝对 Location

          // 如果重定向回代理源本身，则需要重写为原始主机名下的路径
          if (redirectedUrl.origin === targetUrl.origin) {
              const newLocation = url.origin + matchedPrefix + redirectedUrl.pathname + redirectedUrl.search;
              context.log(`Rewriting redirect from ${location} to ${newLocation}`);
              newResponse.headers.set('Location', newLocation);
          } else {
              // 如果重定向到外部域，则直接使用
              context.log(`Proxying redirect to external location: ${location}`);
          }
      }
      
      return newResponse;

    } catch (error) {
      context.log("Error fetching target URL:", error);
      return new Response("代理请求失败", { 
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain;charset=UTF-8'
        }
      });
    }
  }

  // 如果没有匹配的代理规则，则不处理此请求，交由 Netlify 的其他规则处理
  // context.log(`No proxy rule matched for "${path}". Passing through.`);
  return; // 或者 return undefined;
}; 