import requests
from bs4 import BeautifulSoup

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
            # The 'Doc number' seems to be inside the th, but it also contains other text
            th = row.find('th')
            cols = row.find_all('td')
            
            if th and len(cols) >= 3:
                # Based on the inspection, the th content is '2026-XXXX...' 
                # followed by the row data.
                # Let's try extracting just the first part (the doc number)
                raw_text = th.get_text(strip=True)
                # Assuming the pattern is "YYYY-NNN..."
                doc_number = raw_text.split(' ')[0] # This might need better parsing
                # Actually, looking at the previous output: 
                # '2026-285Direct...'
                # It seems it's just concatenated. 
                # A safer bet might be to look for the pattern
                import re
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
    print(f"Scraped {len(data)} items.")
    for item in data[:5]:
        print(item)
