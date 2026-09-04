import './BrandLogo.css';

export default function BrandLogo({ className = '' }) {
  return (
    <img
      className={`brand-logo ${className}`}
      src="/brand/elegant-lashes-by-katie.webp"
      width="284"
      height="97"
      alt="Elegant Lashes by Katie"
      draggable={false}
    />
  );
}
