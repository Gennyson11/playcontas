import { GENNYSON_AVATAR_URL } from "./avatarStore";

export interface TopSellerItem {
  key: string;
  name: string;
  avatar: string;
  verified: boolean;
  isAdmin: boolean;
  revenue: number;
  sales: number;
}

export const FICTIONAL_TOP_SELLERS: TopSellerItem[] = [
  {
    key: "gennyson-marinho",
    name: "Gennyson Marinho",
    avatar: GENNYSON_AVATAR_URL,
    verified: true,
    isAdmin: true,
    revenue: 58420,
    sales: 1940,
  },
  {
    key: "nexstore-digital",
    name: "NexStore Digital",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=NexStore&backgroundColor=0066FF",
    verified: true,
    isAdmin: false,
    revenue: 42150,
    sales: 1580,
  },
  {
    key: "smolder-tools",
    name: "Smolder Tools",
    avatar:
      "https://lazueuycrcqirdykdppm.supabase.co/storage/v1/object/public/avatars/avatar-fensmolder_gmail_com-1794089479788.gif",
    verified: true,
    isAdmin: false,
    revenue: 34800,
    sales: 1120,
  },
  {
    key: "alpha-games",
    name: "Alpha Games & Contas",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AlphaGames&backgroundColor=ffd5dc",
    verified: true,
    isAdmin: false,
    revenue: 27640,
    sales: 940,
  },
  {
    key: "prime-licenses",
    name: "PrimeLicenses BR",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=PrimeLicenses&backgroundColor=c0aede",
    verified: true,
    isAdmin: false,
    revenue: 21890,
    sales: 780,
  },
  {
    key: "cloudhub-brasil",
    name: "CloudHub Brasil",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=CloudHub&backgroundColor=d1d4f9",
    verified: true,
    isAdmin: false,
    revenue: 16450,
    sales: 620,
  },
  {
    key: "bytemaster-premium",
    name: "ByteMaster Premium",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ByteMaster&backgroundColor=ffdfbf",
    verified: true,
    isAdmin: false,
    revenue: 13200,
    sales: 490,
  },
  {
    key: "nexus-streaming",
    name: "Nexus Streaming",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=NexusStream&backgroundColor=c0aede",
    verified: true,
    isAdmin: false,
    revenue: 10750,
    sales: 410,
  },
  {
    key: "devtools-store",
    name: "DevTools Store",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=DevToolsBR&backgroundColor=b6e3f4",
    verified: true,
    isAdmin: false,
    revenue: 8620,
    sales: 330,
  },
  {
    key: "elitepass-club",
    name: "ElitePass Club",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ElitePass&backgroundColor=ffd5dc",
    verified: true,
    isAdmin: false,
    revenue: 6940,
    sales: 260,
  },
];
