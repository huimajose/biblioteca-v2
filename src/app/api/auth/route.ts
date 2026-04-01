import ImageKit from "imagekit";
import { NextResponse } from "next/server";

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_PUBLIC_KEY!,
  privateKey: process.env.PRIVATE_KEY!,
  urlEndpoint: process.env.NEXT_PUBLIC_URL_ENDPOINT!,
});

// Cache the authentication parameters
let cachedAuth: { signature: string; expire: number; token: string } | null = null;
let cacheExpiry: number = 0;

export async function GET() {
  const now = Date.now();
  
  // If cache is valid, return cached parameters
  if (cachedAuth && cacheExpiry > now) {
    return NextResponse.json(cachedAuth);
  }

  // Get new parameters and cache them
  const auth = imagekit.getAuthenticationParameters();
  cachedAuth = auth;
  // Cache for 10 minutes
  cacheExpiry = now + 10 * 60 * 1000;
  
  return NextResponse.json(auth);
}
