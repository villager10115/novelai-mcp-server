/**
 * index.js for SillyTavern front-end integration
 * This bridges the MCP server to the SillyTavern extensions system
 */

(() => {
    // 确保 window.sillyTavernExtensions 可用
    if (!window.sillyTavernExtensions) {
        window.sillyTavernExtensions = [];
    }

    const extension = {
        name: "novelai-mcp-server",        // 内部标识
        displayName: "NovelAI MCP Server", // UI 显示
        version: "1.0.0",
        author: "villager10115",
        type: "server",                    // 后端服务类型
        init: async () => {
            console.log("[NovelAI MCP Server] Initializing MCP server bridge...");

            // 可选：检测 MCP 服务是否启动
            try {
                const status = await fetch("http://localhost:20000/status"); // 假设 MCP 默认端口
                if (status.ok) {
                    console.log("[NovelAI MCP Server] MCP server is running.");
                } else {
                    console.warn("[NovelAI MCP Server] MCP server not reachable.");
                }
            } catch (err) {
                console.warn("[NovelAI MCP Server] Error connecting to MCP server:", err);
            }
        }
    };

    // 注册扩展到 SillyTavern
    window.sillyTavernExtensions.push(extension);
})();
