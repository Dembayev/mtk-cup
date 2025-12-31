import { badgeVariants } from '../../constants';

export const Badge = ({ children, variant = "default" }) => {
  const variantStyle = badgeVariants[variant] || badgeVariants.default;
  return (
    <span style={{
      padding: "4px 10px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 600,
      ...variantStyle
    }}>
      {children}
    </span>
  );
};
