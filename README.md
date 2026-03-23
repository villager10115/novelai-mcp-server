# NovelAI MCP Server

一个基于 `@modelcontextprotocol/sdk` 的 MCP 服务器，使用 NovelAI 的 Persistent API Token 鉴权。

这个实现明确要求环境变量里的 token 以 `pst-` 开头。

## 依据

- NovelAI 官方文档说明可以在 User Settings -> Account -> Get Persistent API Token 获取长期 API Token。
- NovelAI 官方脚本文档说明当前文本生成采用 OpenAI-like 的 `messages/completions` 形式，常见参数包含 `model`、`temperature`、`max_tokens`、`top_p`、`top_k`、`min_p`、`frequency_penalty`、`presence_penalty`、`stop`、`enable_thinking`。
- 当前图片工具调用的是 `https://image.novelai.net/ai/generate-image`。

## 环境变量

```bash
export NOVELAI_TOKEN=pst-xxxxxxxxxxxxxxxx

（ps：也可以使用set pst-xxxx的方式全局设置）

# 可选：文本接口基础地址
export NOVELAI_BASE_URL=https://api.novelai.net

# 可选：图片接口基础地址
export NOVELAI_IMAGE_BASE_URL=https://image.novelai.net

# 可选：图片本地输出目录，默认 ./outputs
export NOVELAI_IMAGE_OUTPUT_DIR=./outputs

# 可选：如果你的输出目录已经通过静态文件服务或对象存储网关对外暴露，
# 可以设置一个公共 URL 前缀，让工具返回 public_url
export NOVELAI_IMAGE_PUBLIC_BASE_URL=https://example.com/images
```

## 运行办法：
run step 1: npm install
run step 2: npm start
