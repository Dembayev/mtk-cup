import { Badge } from './Badge';
import { roleLabels, roleToBadgeVariant } from '../../constants';

export const RoleBadges = ({ roles }) => {
  if (!roles || roles.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
      {roles.map(role => (
        <Badge key={role} variant={roleToBadgeVariant[role] || "default"}>
          {roleLabels[role] || role}
        </Badge>
      ))}
    </div>
  );
};
