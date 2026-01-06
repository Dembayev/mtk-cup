import { useState, useEffect} from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { colors } from '../constants/colors';
import { tg, syncAvatar } from '../utils/telegram';

export function useAuth(loadData) {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [screen, setScreen] = useState("welcome");

  useEffect(() => {
    if (tg) {
      setIsTelegram(true);
      tg.ready();
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      document.body.style.backgroundColor = colors.bg;
      if (tg.initDataUnsafe?.user) {
        handleTelegramLogin(tg.initDataUnsafe.user);
      }
    }
  }, []);

  const handleTelegramLogin = async (telegramUser) => {
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", String(telegramUser.id))
        .single();

      if (existingUser) {
        // Синхронизируем аватар
        const newAvatarUrl = await syncAvatar(telegramUser.id);
        if (newAvatarUrl && newAvatarUrl !== existingUser.avatar_url) {
          await supabase.from("users").update({ avatar_url: newAvatarUrl }).eq("id", existingUser.id);
          existingUser.avatar_url = newAvatarUrl;
        }
        
        setUser(existingUser);
        setIsGuest(false);
        
        if (existingUser.onboarding_completed) {
          setScreen("home");
        } else {
          setScreen("onboarding");
        }
      } else {
        // Создаем нового пользователя
        const newAvatarUrl = await syncAvatar(telegramUser.id);
        
        const { data: newUser, error } = await supabase
          .from("users")
          .insert({
            telegram_id: String(telegramUser.id),
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            avatar_url: newAvatarUrl,
            role: "fan",
            onboarding_completed: false
          })
          .select()
          .single();

        if (error) throw error;
        
        setUser(newUser);
        setIsGuest(false);
        setScreen("onboarding");
      }
      
      await loadData();
    } catch (error) {
      console.error("Telegram login error:", error);
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setScreen("home");
  };

  const handleLogout = () => {
    setUser(null);
    setIsGuest(false);
    setScreen("welcome");
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await supabase
        .from("users")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      
      setUser({ ...user, onboarding_completed: true });
      setScreen("home");
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  return {
    user,
    setUser,
    isGuest,
    isTelegram,
    screen,
    setScreen,
    handleTelegramLogin,
    handleGuestLogin,
    handleLogout,
    handleCompleteOnboarding
  };
}
