import sqlite3
import re
from bs4 import BeautifulSoup
import requests
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_ai_summary(title):
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=f"Summarize this title for residents: {title}",
        )
        return response.text
    except:
        return "No summary available."

def scrape_and_seed():
    url = 'https://www.portland.gov/council/votes'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    conn = sqlite3.connect('../prisma/dev.db')
    cursor = conn.cursor()
    
    tables = soup.find_all('table', class_='table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            th = row.find('th')
            cols = row.find_all('td')
            if th and len(cols) >= 3:
                raw_text = th.get_text(strip=True)
                doc_number = re.search(r'\d{4}-\d+', raw_text).group(0) if re.search(r'\d{4}-\d+', raw_text) else raw_text
                title = cols[0].get_text(strip=True)
                member = cols[1].get_text(strip=True)
                vote = cols[2].get_text(strip=True)
                
                # Simplified seeding: Upserting doc and member, then inserting vote
                # For a true seed, we'd handle Members/Docs more robustly
                cursor.execute("INSERT OR IGNORE INTO council_documents (doc_number, title, vote_date) VALUES (?, ?, ?)", (doc_number, title, '2026-01-01'))
                cursor.execute("INSERT OR IGNORE INTO council_members (id, full_name, district) VALUES (?, ?, ?)", (member, member, 0))
                cursor.execute("INSERT OR IGNORE INTO member_votes (id, doc_number, member_id, vote) VALUES (?, ?, ?, ?)", (f"{doc_number}-{member}", doc_number, member, vote))
    
    conn.commit()
    conn.close()
    print("Database seeding complete.")

if __name__ == "__main__":
    scrape_and_seed()
