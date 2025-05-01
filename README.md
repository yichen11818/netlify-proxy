# 优雅反向代理服务 🌐

<div align="center">

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-netlify-id/deploy-status)](https://app.netlify.com/sites/your-netlify-name/deploys)
![Edge Functions](https://img.shields.io/badge/Edge_Functions-00C7B7?style=flat-square&logo=netlify&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

*一个基于 Netlify Edge Functions 的强大反向代理服务，支持任意网站内容代理和路径重写。*

</div>

---

## ✨ 特性

- 🔄 **多站点代理** - 预配置多个网站，通过简单路径访问
- 🌍 **通用代理** - 使用 `/proxy/` 前缀代理任意 URL
- 🖼️ **资源重写** - 自动修复 CSS、JavaScript 和图片路径
- 📱 **响应式处理** - 完美支持动态加载的内容和交互功能
- 🔓 **CORS 支持** - 自动添加跨域头，解决 API 访问限制
- ⚡ **高性能** - 利用 Netlify Edge Functions 全球分布式网络

---

## 🚀 使用方法

### 预配置网站

访问以下路径即可使用预配置的网站：

```
https://fd-gally.netlify.app/hexo      # Hexo 博客
https://fd-gally.netlify.app/hexo2     # Hexo 博客 2
https://fd-gally.netlify.app/halo      # Halo 博客
https://fd-gally.netlify.app/kuma      # Kuma 监控面板
https://fd-gally.netlify.app/tv        # TV 服务
https://fd-gally.netlify.app/news      # 新闻聚合
```

### API 代理

使用以下路径访问各种 API 服务：

```
https://fd-gally.netlify.app/openai    # OpenAI API
https://fd-gally.netlify.app/claude    # Claude/Anthropic API
https://fd-gally.netlify.app/gemini    # Google Gemini API
```

更多 API 请参考配置文件。

### 通用代理

代理任意 URL，支持两种格式：

```
# 直接使用目标 URL
https://fd-gally.netlify.app/proxy/https://example.com/path

# URL 编码的形式
https://fd-gally.netlify.app/proxy/https%3A%2F%2Fexample.com%2Fpath
```

---

## 🛠️ 技术实现

- 🔷 **Netlify Edge Functions** - 在全球边缘节点执行代理逻辑
- 📘 **TypeScript** - 类型安全的代码实现
- 🔍 **正则表达式** - 精确的资源路径重写
- 📝 **DOM 修改** - 动态内容加载修复

---

## ⚙️ 自定义配置

在 `netlify/edge-functions/proxy-handler.ts` 文件中：

1. 修改 `PROXY_CONFIG` 对象添加新的代理规则：

```typescript
const PROXY_CONFIG = {
  "/新路径": "https://目标网站.com",
  // ...
};
```

2. 为特定网站添加专门优化：

```typescript
const SPECIAL_REPLACEMENTS = {
  '目标域名': [
    {
      pattern: /正则表达式/,
      replacement: (match) => '替换逻辑'
    }
  ]
};
```

---

## 📋 部署指南

1. Fork 本项目
2. 注册 Netlify 账号
3. 创建新站点并连接 GitHub 仓库
4. 使用默认设置部署

---

## 🌟 高级用例

- 🚫 **内容过滤** - 添加代码移除目标站点的广告
- 🔗 **API 聚合** - 在一个域名下整合多个 API 服务
- 🔒 **地区解锁** - 通过 Edge Functions 全球网络访问地区限制内容

---

## ⚠️ 注意事项

- 请遵守目标网站的服务条款
- 避免代理敏感或受版权保护的内容
- 某些复杂网站可能需要额外配置才能正常工作

---

## 📄 许可证

MIT License © 2025

<div align="center">
  <sub>Made with ❤️ by <a href="https://github.com/gally16">gally16</a></sub>
</div> 