import requests
from bs4 import BeautifulSoup
import os
import re
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_ai_summary(title):
    prompt = f"""
    Summarize this City Council document title into a 2-3 sentence plain-language summary for residents. 
    Explain what changed/authorized and its implications.
    Title: {title}
    """
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"Could not generate summary: {e}"

def scrape_votes():
    url = 'https://www.portland.gov/council/votes'
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Failed to fetch {url}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Target the tables containing the data
    tables = soup.find_all('table', class_='table')
    
    votes = []
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            th = row.find('th')
            cols = row.find_all('td')
            if th and len(cols) >= 3:
                raw_text = th.get_text(strip=True)
                match = re.search(r'\d{4}-\d+', raw_text)
                doc_number = match.group(0) if match else raw_text
                title = cols[0].get_text(strip=True)
                member = cols[1].get_text(strip=True)
                vote = cols[2].get_text(strip=True)
                
                votes.append({
                    'doc_number': doc_number,
                    'title': title,
                    'member': member,
                    'vote': vote
                })
    return votes

if __name__ == "__main__":
    data = scrape_votes()
    print(f"Scraped {len(data)} items. Generating summary for first item...")
    
    if data:
        summary = get_ai_summary(data[0]['title'])
        print(f"Title: {data[0]['title']}")
        print(f"Summary: {summary}")
