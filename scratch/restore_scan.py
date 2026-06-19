import json
import re

def scan():
    transcript_path = r"C:\Users\micha\.gemini\antigravity-ide\brain\3a62bbfb-d2ff-4760-aefa-7638ae05594d\.system_generated\logs\transcript.jsonl"
    
    steps = []
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                steps.append(json.loads(line))
            except:
                pass
                
    print(f"Loaded {len(steps)} steps.")
    
    # We will search for all VIEW_FILE steps where app.js is the target and extract their line ranges
    for step in steps:
        if step.get('type') == 'VIEW_FILE':
            content = step.get('content', '')
            if 'app.js' in content:
                # Extract file path, lines, and a snippet
                print(f"Step {step.get('step_index')}:")
                # Look for "Showing lines X to Y"
                match = re.search(r'Showing lines (\d+) to (\d+)', content)
                if match:
                    print(f"  Lines: {match.group(1)} to {match.group(2)}")
                else:
                    print(f"  Snippet: {content[:150].replace(chr(10), ' ')}")

if __name__ == '__main__':
    scan()
