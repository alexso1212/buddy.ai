interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

interface WebSearchResponse {
  answer: string;
  results: WebSearchResult[];
}

export async function searchWeb(query: string, maxResults?: number): Promise<WebSearchResponse> {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn('TAVILY_API_KEY not configured');
      return { answer: '', results: [] };
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults || 5,
        include_answer: true,
        search_depth: 'basic',
      }),
    });

    if (!response.ok) {
      console.error('Tavily API error:', response.status, await response.text().catch(() => ''));
      return { answer: '', results: [] };
    }

    const data = await response.json();

    const results: WebSearchResult[] = (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
    }));

    return {
      answer: data.answer || '',
      results,
    };
  } catch (err) {
    console.error('Web search error:', err);
    return { answer: '', results: [] };
  }
}
