/**
 * 发送一条测试消息触发 Claude CLI，然后抓取完整的消息流
 */
import WebSocket from "ws";

const WS_URL = "ws://localhost:3001/ws/browser";
const ws = new WebSocket(WS_URL);

// 用固定 sessionId 避免创建太多会话
// 先创建新会话
ws.on("open", () => {
  console.log("已连接，创建新会话...");
  ws.send(JSON.stringify({
    type: "create_session",
    projectPath: "D:\\codes",
  }));
});

let sessionCount = 0;

ws.on("message", (data) => {
  const text = data.toString().trim();

  for (const line of text.split("\n").filter((l) => l.trim())) {
    try {
      const msg = JSON.parse(line);
      if (sessionCount === 0 && msg.type === "session_info" && msg.sessionId) {
        sessionCount++;
        const sessionId = msg.sessionId;
        console.log(`会话已创建: ${sessionId.substring(0, 8)}...`);
        console.log("现在发送测试消息...");

        // 稍等一下再发消息，确保 local 服务处理完
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: "chat",
            sessionId,
            text: "1+1=?",
          }));
          console.log(`已发送: "1+1=?"`);
        }, 1000);
      }

      // 记录所有消息类型
      if (msg.type === "claude_json") {
        const data = msg.data;
        if (data?.type === "system" && data?.subtype === "init") {
          console.log(`\n[系统初始化] model="${data.model}"`);
        } else if (data?.type === "result") {
          console.log(`\n[结果消息]`);
          console.log(`  total_cost_usd: ${data.total_cost_usd}`);
          console.log(`  usage: ${JSON.stringify(data.usage)}`);
          console.log(`  modelUsage: ${JSON.stringify(data.modelUsage)}`);
          console.log(`  完整 result: ${JSON.stringify(data).substring(0, 500)}`);

          // 模拟前端提取逻辑
          if (data.usage) {
            const u = data.usage;
            let contextWindow = 0;
            if (data.modelUsage) {
              const models = Object.keys(data.modelUsage);
              if (models.length > 0) {
                contextWindow = data.modelUsage[models[0]].contextWindow || 0;
              }
            }
            console.log(`\n  → 前端应显示:`);
            console.log(`     模型: (从 init 获取)`);
            console.log(`     Tokens: ${u.input_tokens} in / ${u.output_tokens} out`);
            console.log(`     费用: $${data.total_cost_usd?.toFixed(4)}`);
            console.log(`     上下文窗口: ${contextWindow}`);
            console.log(`     占比: ${contextWindow > 0 ? ((u.input_tokens + (u.cache_read_input_tokens || 0)) / contextWindow * 100).toFixed(0) + '%' : 'N/A'}`);
          }

          console.log("\n✅ 测试完成，退出");
          ws.close();
          process.exit(0);
        }
      } else if (msg.type === "error") {
        console.log(`\n错误: ${JSON.stringify(msg)}`);
        ws.close();
        process.exit(1);
      }
    } catch {
      // 忽略
    }
  }
});

ws.on("error", (err) => {
  console.error("WebSocket 错误:", err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log("30秒超时，退出");
  ws.close();
  process.exit(1);
}, 30000);
