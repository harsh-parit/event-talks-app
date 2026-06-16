import re
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_content(html_content):
    """
    Cleans up HTML content from the feed:
    - Normalizes spacing.
    - Resolves relative links if any.
    - Strips unwanted tags if necessary but keeps style tags / formatting intact.
    """
    if not html_content:
        return ""
    # Google cloud release feeds often have relative links starting with /
    soup = BeautifulSoup(html_content, 'html.parser')
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/'):
            a['href'] = 'https://cloud.google.com' + href
    return str(soup)

def parse_release_notes():
    """
    Fetches and parses the BigQuery release notes feed.
    Splits multi-update entries (using <h3> tags) into individual update items.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        xml_data = response.content
    except Exception as e:
        print(f"Error fetching feed: {e}")
        return {"error": f"Failed to fetch release notes: {str(e)}"}, 500

    try:
        # Register namespaces to parse Atom feeds
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_data)
        
        feed_title = root.find('atom:title', namespaces)
        feed_title = feed_title.text if feed_title is not None else "BigQuery Release Notes"
        
        feed_updated = root.find('atom:updated', namespaces)
        feed_updated = feed_updated.text if feed_updated is not None else ""

        entries = []
        update_id_counter = 1

        for entry in root.findall('atom:entry', namespaces):
            date_str = entry.find('atom:title', namespaces)
            date_str = date_str.text if date_str is not None else "Unknown Date"
            
            entry_id = entry.find('atom:id', namespaces)
            entry_id = entry_id.text if entry_id is not None else ""
            
            entry_updated = entry.find('atom:updated', namespaces)
            entry_updated = entry_updated.text if entry_updated is not None else ""
            
            link_el = entry.find('atom:link[@rel="alternate"]', namespaces)
            if link_el is None:
                link_el = entry.find('atom:link', namespaces)
            link_url = link_el.attrib.get('href') if link_el is not None else ""

            content_el = entry.find('atom:content', namespaces)
            if content_el is None or not content_el.text:
                continue

            content_html = content_el.text.strip()
            
            # Split the entry content by <h3> headers to isolate individual updates on the same day
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_type = None
            current_elements = []
            
            # Helper to commit an update
            def add_update(update_type, html_elems):
                nonlocal update_id_counter
                if not update_type or not html_elems:
                    return
                
                # Combine html elements
                item_html = "".join(str(el) for el in html_elems).strip()
                item_html_cleaned = clean_html_content(item_html)
                
                # Extract clean text for Twitter/search
                item_soup = BeautifulSoup(item_html, 'html.parser')
                item_text = item_soup.get_text(separator=' ').strip()
                # Remove extra spaces
                item_text = re.sub(r'\s+', ' ', item_text)
                
                # Define specific anchor link on page if possible
                anchor_id = date_str.replace(" ", "_").replace(",", "")
                # Create a specific URL if they have anchor links
                item_link = f"https://cloud.google.com/bigquery/docs/release-notes#{anchor_id}"
                
                entries.append({
                    "id": f"up-{update_id_counter}",
                    "date": date_str,
                    "raw_date": entry_updated,
                    "type": update_type,
                    "html": item_html_cleaned,
                    "text": item_text,
                    "link": link_url or item_link
                })
                update_id_counter += 1

            for child in soup.children:
                if child.name == 'h3':
                    # Save the previous block before starting a new one
                    if current_type and current_elements:
                        add_update(current_type, current_elements)
                    # Start new block
                    current_type = child.get_text().strip()
                    current_elements = []
                else:
                    if child.name is not None or str(child).strip():
                        current_elements.append(child)
            
            # Don't forget the last update block in the entry
            if current_type and current_elements:
                add_update(current_type, current_elements)

        return {
            "title": feed_title,
            "last_updated": feed_updated,
            "updates": entries
        }

    except Exception as e:
        print(f"Error parsing feed XML: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to parse release notes: {str(e)}"}, 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    data = parse_release_notes()
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
