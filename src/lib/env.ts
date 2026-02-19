/**
 * 环境变量与配置
 */

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string): string {
  const v = getEnv(key);
  if (v === undefined || v === "") {
    throw new Error(`缺少必需环境变量: ${key}`);
  }
  return v;
}

export const env = {
  /** Tavily API Key (AI-Search-Audit) - 从 https://tavily.com 获取 */
  get TAVILY_API_KEY(): string | undefined {
    return getEnv("TAVILY_API_KEY");
  },

  /** WordPress 站点 URL，例如 https://yoursite.com */
  get WORDPRESS_URL(): string | undefined {
    return getEnv("WORDPRESS_URL");
  },

  /** WordPress 用户名（用于 Application Password 认证） */
  get WORDPRESS_USER(): string | undefined {
    return getEnv("WORDPRESS_USER");
  },

  /** WordPress Application Password（在 WP 后台 用户 → 应用密码 生成） */
  get WORDPRESS_APP_PASSWORD(): string | undefined {
    return getEnv("WORDPRESS_APP_PASSWORD");
  },

  /** 可选：Brave Search API Key（若不用 Tavily 可改用 Brave） */
  get BRAVE_API_KEY(): string | undefined {
    return getEnv("BRAVE_API_KEY");
  },
} as const;

export function requireTavily(): string {
  return requireEnv("TAVILY_API_KEY");
}

export function requireWordPress(): { url: string; user: string; password: string } {
  return {
    url: requireEnv("WORDPRESS_URL").replace(/\/$/, ""),
    user: requireEnv("WORDPRESS_USER"),
    password: requireEnv("WORDPRESS_APP_PASSWORD"),
  };
}
