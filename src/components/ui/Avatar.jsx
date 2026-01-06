import { useState } from 'react';
import { colors } from '../../constants/colors';

export const Avatar = ({ name, size = 48, url }) => {
  const [imgError, setImgError] = useState(false);
  const showImage = url && !imgError;
  return (
    <div style={{
      width: size,
      height: size,
      background: showImage ? "transparent" : colors.goldLight,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 600,
      fontSize: size * 0.4,
      color: colors.goldDark,
      overflow: "hidden",
    }}>
      {showImage ? (
        <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgError(true)} />
      ) : (
        name?.[0] === "@" ? name?.[1]?.toUpperCase() : name?.[0]?.toUpperCase()
      )}
    </div>
  );
};
