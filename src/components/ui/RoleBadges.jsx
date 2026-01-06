import { Badge } from './Badge';
import { roleLabels } from '../../constants/labels';

export const RoleBadges = ({ roles }) => {
  const roleVariants = {
    admin: "admin",
    coach: "gold",
    captain: "captain",
    player: "free",
    fan: "default",
  };
  
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {roles.map(role => (
        <Badge key={role} variant={roleVariants[role]}>
          {roleLabels[role]}
        </Badge>
      ))}
    </div>
  );
};
