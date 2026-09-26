import { Box, Image } from "@mantine/core";

export function CrmProviderLogo({
  name,
  logo,
  initials,
  size = 40,
}: {
  name: string;
  logo: string;
  initials: string;
  size?: number;
}) {
  return (
    <Box
      w={size}
      h={size}
      p={6}
      bg="gray.0"
      style={{ borderRadius: "var(--mantine-radius-md)", flex: `0 0 ${size}px` }}
    >
      <Image src={logo} alt={`${name} logo`} w="100%" h="100%" fit="contain" loading="lazy" fallbackSrc={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="12">${initials}</text></svg>`)}`} />
    </Box>
  );
}
