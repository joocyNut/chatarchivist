import json
import os
from zipfile import ZipFile, BadZipFile
from datetime import datetime, timezone
import sys
import uuid

def format_tiddlywiki_date(epoch_time):
    '''Convert epoch time to TiddlyWiki date format YYYYMMDDhhmmssss, using timezone-aware datetime.'''
    if epoch_time is not None and isinstance(epoch_time, (int, float)):
        return datetime.fromtimestamp(epoch_time, timezone.utc).strftime('%Y%m%d%H%M%S0000')
    else:
        return None  # Return None to signal that the timestamp was invalid

def process_exported_json(data, filename):
    tiddlers = []
    conversation_id = str(uuid.uuid4())

    conversation_tiddler = {
        'title': conversation_id,
        'tags': 'chatgptconversation',
        'chatgptelement': 'conversation',
        'conversation_title': data.get('title', 'UnknownTitle')
    }
    tiddlers.append(conversation_tiddler)

    for i, (node_id, node_data) in enumerate(data.get('mapping', {}).items(), start=1):
        message = node_data.get('message')
        if message is not None and 'create_time' in message:
            message_id = str(uuid.uuid4())
            timestamp = message['create_time']

            formatted_timestamp = format_tiddlywiki_date(timestamp)
            if not formatted_timestamp:  
                continue  # Skip to the next message if timestamp is invalid

            # Only proceed if timestamp is valid
            title = f"conv{conversation_id}_msg{i}_{message_id}"
            tiddler = {
                'title': title,
                'text': message.get('content', {}).get('parts', [''])[0],
                'author': message.get('author', {}).get('role', 'unknown'),
                'conversation_id': conversation_id,
                'message_id': message_id,
                'tags': 'chatgptmessage',
                'timestamp': formatted_timestamp  # Use the valid timestamp here
            }
            tiddlers.append(tiddler)

    return tiddlers

def process_zip_and_exported_json(zip_filepath, output_dir):
    all_tiddlers = []
    try:
        with ZipFile(zip_filepath, 'r') as zip_ref:
            for filename in zip_ref.namelist():
                if filename.endswith('.json'):
                    with zip_ref.open(filename) as json_file:
                        try:
                            data = json.load(json_file)
                            tiddlers = process_exported_json(data, filename)
                            all_tiddlers.extend(tiddlers)
                        except json.JSONDecodeError as e:
                            print(f"Error loading JSON from {filename}: {e}")
    except (FileNotFoundError, BadZipFile) as e:
        print(f"Error processing zip file '{zip_filepath}': {e}")
        sys.exit(1)
    
    output_filename = os.path.join(output_dir, 'all_conversations_tiddlywiki.json')
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(all_tiddlers, f, ensure_ascii=False, indent=4)

    return output_filename

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python script.py <path_to_zip_file> <output_directory>")
        sys.exit(1)

    zip_filepath = sys.argv[1]
    output_dir = sys.argv[2]

    os.makedirs(output_dir, exist_ok=True)

    output_file_path = process_zip_and_exported_json(zip_filepath, output_dir)
    print(f'Conversations extracted and saved to {output_file_path}')