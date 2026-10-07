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

      // ==========================================
      // CALLBACK QUERY
      // ==========================================

      if (update.callback_query) {
        const callback = update.callback_query;
        const data = callback.data || "";
        const callbackUserId = String(callback.from.id);

        // ---------- دکمه‌های کاربر ----------

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

        // ---------- فقط ادمین ----------

        if (
          callbackUserId !== String(env.ADMIN_ID)
        ) {
          return new Response("OK");
        }

        // ---------- انتشار ----------

        if (data.startsWith("publish|")) {
          const parts = data.split("|");

          const senderChatId = parts[1];
          const originalMessageId = parts[2];

          if (!env.CHANNEL_ID) {
            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "CHANNEL_ID تنظیم نشده!"
            });

            return new Response("OK");
          }

          const result = await telegram("copyMessage", {
            chat_id: env.CHANNEL_ID,
            from_chat_id: senderChatId,
            message_id: originalMessageId
          });

          if (!result.ok) {
            await telegram("answerCallbackQuery", {
              callback_query_id: callback.id,
              text: "انتشار ناموفق بود ❌"
            });

            return new Response("OK");
          }

          // حذف دکمه‌های ادمین
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

        // ---------- رد کردن ----------

        if (data.startsWith("reject|")) {
          const parts = data.split("|");

          const senderChatId = parts[1];

          await telegram("sendMessage", {
            chat_id: senderChatId,
            text: "😡😡"
          });

          // حذف دکمه‌های ادمین
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

      // ==========================================
      // MESSAGE
      // ==========================================
      if (update.message) {
        const message = update.message;
        const chatId = String(message.chat.id);

        // ==========================================
        // /start
        // ==========================================

       if (
  message.chat.type === "private" &&
  message.text === "/start"
) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: "س خ؟"
  });

  await env.USER_STATE.put(
    chatId,
    "allowed_to_send"
  );

  return new Response("OK");
       } 
        

        // ==========================================
        // پیام خصوصی کاربران
        // ==========================================

        if (
          message.chat.type === "private" &&
          chatId !== String(env.ADMIN_ID)
        ) {
          const state =
            await env.USER_STATE.get(chatId);

          // کاربر ارسال را بسته
          if (state === "closed") {
            return new Response("OK");
          }

          // منتظر انتخاب کاربر
          if (state === "awaiting_choice") {
            await telegram("sendMessage", {
              chat_id: chatId,
              text: "اول یکی از دو گزینه رو بزن 👆"
            });

            return new Response("OK");
          }

          // اجازه ارسال ندارد
          if (state !== "allowed_to_send") {
            return new Response("OK");
          }

          // ========================================
          // ثبت ارسال
          // ========================================

          await env.USER_STATE.put(
            chatId,
            "awaiting_choice"
          );

          // ========================================
          // اطلاعات کاربر
          // ========================================

          const firstName =
            message.from?.first_name || "بدون نام";

          const lastName =
            message.from?.last_name || "";

          const username =
            message.from?.username
              ? `@${message.from.username}`
              : "ندارد";

          const userInfo =
            `📩 ارسال جدید\n\n` +
            `👤 نام: ${firstName} ${lastName}\n` +
            `🆔 User ID: ${chatId}\n` +
            `🔹 Username: ${username}`;

          const adminResult = await telegram("sendMessage", {
  chat_id: env.ADMIN_ID,
  text: userInfo
});

await telegram("sendMessage", {
  chat_id: env.ADMIN_ID,
  text: "ADMIN RESULT: " + JSON.stringify(adminResult)
});

console.log("ADMIN MESSAGE SENT");
          // ========================================
          // کپی محتوای کاربر برای ادمین
          // ========================================

          const copied =
            await telegram("copyMessage", {
              chat_id: env.ADMIN_ID,
              from_chat_id: chatId,
              message_id: message.message_id
            });

          // ========================================
          // دکمه‌های ادمین
          // ========================================

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
                        `publish|${chatId}|${message.message_id}`
                    },
                    {
                      text: "🚫 نخ اص",
                      callback_data:
                        `reject|${chatId}`
                    }
                  ]
                ]
              }
            });
          }

          // ========================================
          // سوال از کاربر
          // ========================================

          await telegram("sendMessage", {
            chat_id: chatId,
            text: "نون میخواین؟",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ تیک",
                    callback_data: "user_yes"
                  },
                  {
                    text: "❌ ضربدر",
                    callback_data: "user_no"
                  }
                ]
              ]
            }
          });

          return new Response("OK");
        }
      }

      return new Response("OK");

    } catch (error) {
      console.log("ERROR:", error);

      return new Response("OK");
    }
  }
};
