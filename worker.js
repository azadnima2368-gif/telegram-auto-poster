export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

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

      // ==================================================
      // CALLBACK QUERY
      // ==================================================

      if (update.callback_query) {
        const callback = update.callback_query;
        const data = callback.data || "";
        const callbackUserId = String(callback.from.id);

        // ==================================================
        // دکمه‌های کاربر
        // ==================================================

        if (data === "user_yes") {
          await env.USER_STATE.put(
            callbackUserId,
            "allowed_to_send"
          );

          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "✅"
          });

          return new Response("OK");
        }

        if (data === "user_no") {
          await env.USER_STATE.put(
            callbackUserId,
            "closed"
          );

          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "❌"
          });

          await telegram("sendMessage", {
            chat_id: callbackUserId,
            text: "😢"
          });

          return new Response("OK");
        }

        // ==================================================
        // از اینجا به بعد فقط ادمین
        // ==================================================

        if (
          callbackUserId !== String(env.ADMIN_ID)
        ) {
          return new Response("OK");
        }

        // ==================================================
        // انتشار
        // ==================================================

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

          if (!result.ok) {
            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "انتشار ناموفق بود ❌"
            });

            return new Response("OK");
          }

          // حذف دکمه‌های تصمیم از پیام ادمین
          if (callback.message) {
            await telegram("editMessageReplyMarkup", {
              chat_id: callback.message.chat.id,
              message_id: callback.message.message_id,
              reply_markup: {
                inline_keyboard: []
              }
            });
          }

          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "منتشر شد ✅"
          });

          await telegram("sendMessage", {
            chat_id: env.ADMIN_ID,
            text: "🐑 بف بف — منتشر شد ✅"
          });

          return new Response("OK");
        }

        // ==================================================
        // رد کردن
        // ==================================================

        if (data.startsWith("reject|")) {
          const parts = data.split("|");

          const userChatId = parts[1];

          // ارسال پیام رد به کاربر
          await telegram("sendMessage", {
            chat_id: userChatId,
            text: "😡😡"
          });

          // حذف دکمه‌های تصمیم از پیام ادمین
          if (callback.message) {
            await telegram("editMessageReplyMarkup", {
              chat_id: callback.message.chat.id,
              message_id: callback.message.message_id,
              reply_markup: {
                inline_keyboard: []
              }
            });
          }

          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "رد شد ❌"
          });

          await telegram("sendMessage", {
            chat_id: env.ADMIN_ID,
            text: "🚫 نخ اص — ارسال رد شد."
          });

          return new Response("OK");
        }

        return new Response("OK");
      }

      // ==================================================
      // MESSAGE
      // ==================================================

      if (update.message) {
        const message = update.message;

        const userChatId
