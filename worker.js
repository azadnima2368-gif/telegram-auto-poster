
export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

      // =========================
      // Telegram API
      // =========================
      async function telegram(method, data) {
        const response = await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
          }
        );

        return await response.json();
      }

      // =========================
      // /start
      // =========================
      if (update.message?.text === "/start") {
        await telegram("sendMessage", {
          chat_id: update.message.chat.id,
          text: "س خ"
        });

        return new Response("OK");
      }

      // =========================
      // User message
      // =========================
      if (update.message) {
        const message = update.message;
        const userChatId = message.chat.id;

        // فقط پیام‌های خصوصی کاربران
        if (message.chat.type === "private" && userChatId != env.ADMIN_ID) {

          // پاسخ به کاربر
          await telegram("sendMessage", {
            chat_id: userChatId,
            text: "خخخخ"
          });

          // اطلاعات کاربر
          const firstName =
            message.from?.first_name || "بدون نام";

          const lastName =
            message.from?.last_name || "";

          const username =
            message.from?.username
              ? `@${message.from.username}`
              : "ندارد";

          const userInfo =
`📩 ارسال جدید

👤 نام: ${firstName} ${lastName}
🆔 User ID: ${userChatId}
🔹 Username: ${username}`;

          // اطلاعات فرستنده برای ادمین
          await telegram("sendMessage", {
            chat_id: env.ADMIN_ID,
            text: userInfo
          });

          // کپی خود پیام برای ادمین
          const copied = await telegram("copyMessage", {
            chat_id: env.ADMIN_ID,
            from_chat_id: userChatId,
            message_id: message.message_id
          });

          // دکمه‌های ادمین
          if (copied.ok) {
            await telegram("sendMessage", {
              chat_id: env.ADMIN_ID,
              text: "با این ارسال چیکار کنیم؟",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🐑 بف بف",
                      callback_data:
                        `publish|${userChatId}|${message.message_id}`
                    },
                    {
                      text: "🚫 نخ اص",
                      callback_data:
                        `reject|${userChatId}`
                    }
                  ]
                ]
              }
            });
          }

          // =========================
          // 30 second timer
          // =========================
          ctx.waitUntil(
            new Promise(resolve => {
              setTimeout(async () => {

                try {
                  await telegram("sendMessage", {
                    chat_id: userChatId,
                    text: "): )"
                  });
                } catch (e) {
                  console.log("Timer error:", e);
                }

                resolve();
              }, 30000);
            })
          );

          return new Response("OK");
        }
      }

      // =========================
      // Admin buttons
      // =========================
      if (update.callback_query) {

        const callback = update.callback_query;

        // فقط ادمین
        if (String(callback.from.id) !== String(env.ADMIN_ID)) {
          return new Response("OK");
        }

        const data = callback.data || "";

        // =========================
        // Publish
        // =========================
        if (data.startsWith("publish|")) {

          const parts = data.split("|");

          const userChatId = parts[1];
          const messageId = parts[2];

          if (!env.CHANNEL_ID) {
            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "CHANNEL_ID تنظیم نشده!"
            });

            return new Response("OK");
          }

          const result = await telegram("copyMessage", {
            chat_id: env.CHANNEL_ID,
            from_chat_id: userChatId,
            message_id: messageId
          });

          if (result.ok) {

            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "منتشر شد ✅"
            });

            await telegram("sendMessage", {
              chat_id: env.ADMIN_ID,
              text: "🐑 بف بف — منتشر شد ✅"
            });

          } else {

            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "انتشار ناموفق بود ❌"
            });
          }

          return new Response("OK");
        }

        // =========================
        // Reject
        // =========================
        if (data.startsWith("reject|")) {

          const parts = data.split("|");

          const userChatId = parts[1];

          await telegram("sendMessage", {
            chat_id: userChatId,
            text: "😡😡"
          });

          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "رد شد ❌"
          });

          await telegram("sendMessage", {
            chat_id: env.ADMIN
