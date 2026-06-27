import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Recommendation: Use process.env.IG_API_KEY for production security
    const apiKey = 'caliphkey'; 
    const account = 'kuzuroken.20';
    const apiUrl = `https://api.caliph.my.id/api/igprofile?acc=${account}&apikey=${apiKey}`;

    const response = await fetch(
      apiUrl,
      {
        next: { revalidate: 60 } // Cache data for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`External API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Process and sanitize data if needed, or just return as is
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error("IG Fetch Error (Server):", error.message);
    
    // Fallback response for stability
    return NextResponse.json({
      success: false,
      data: {
        followers: "1.2K", // Default fallback as requested
        username: "kuzuroken.20",
        full_name: "Kuzu Roken",
        biography: "Zunime Developer",
      }
    });
  }
}
