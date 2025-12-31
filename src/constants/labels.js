// Position labels
export const positionLabels = {
  setter: "Связующий",
  opposite: "Диагональный",
  outside: "Доигровщик",
  middle: "Центральный",
  libero: "Либеро",
};

// Role labels
export const roleLabels = {
  fan: "Болельщик",
  player: "Игрок",
  captain: "Капитан",
  coach: "Тренер",
  admin: "Администратор",
};

// Badge variants
export const badgeVariants = {
  default: { background: "#f3f4f6", color: "#374151" },
  gold: { background: "#fef3c7", color: "#92400e" },
  free: { background: "#d1fae5", color: "#065f46" },
  captain: { background: "#fef3c7", color: "#92400e" },
  pending: { background: "#fef3c7", color: "#92400e" },
  admin: { background: "#dbeafe", color: "#1d4ed8" },
};

// Role to badge variant mapping
export const roleToBadgeVariant = {
  fan: "default",
  player: "free",
  captain: "captain",
  coach: "gold",
  admin: "admin",
};
