with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Находим место перед alert "Заявка одобрена" и добавляем отправку уведомления
old_code = '''      
      await loadData();
      alert("Заявка одобрена и роль изменена!");
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Ошибка");
    } finally {
      setActionLoading(false);
    }
  };'''

new_code = '''      
      // Отправляем Telegram уведомление пользователю
      const approvedUser = users.find(u => u.id === userId);
      if (approvedUser?.telegram_id) {
        const roleNames = {
          player: "игрок",
          coach: "тренер", 
          fan: "болельщик"
        };
        const roleName = roleNames[role] || role;
        const message = `✅ Ваша заявка принята!\\n\\nВы теперь ${roleName} в турнире "Кубок МТК".\\n\\nОткройте приложение чтобы продолжить.`;
        try {
          await fetch(`https://api.telegram.org/bot8513614914:AAFygkqgY7IBf5ktbzcdSXZF7QCOwjrCRAI/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              chat_id: approvedUser.telegram_id, 
              text: message,
              reply_markup: {
                inline_keyboard: [[
                  { text: "📱 Открыть приложение", web_app: { url: "https://mtk-cup.vercel.app" } }
                ]]
              }
            }),
          });
        } catch (e) { console.error("Failed to notify user:", e); }
      }
      
      await loadData();
      alert("Заявка одобрена и роль изменена!");
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Ошибка");
    } finally {
      setActionLoading(false);
    }
  };'''

content = content.replace(old_code, new_code)

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Добавлено Telegram уведомление при принятии заявки на роль")
