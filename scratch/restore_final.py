import json
import re

def parse_view_file_content(content):
    lines = content.splitlines()
    code_lines = {}
    
    for line in lines:
        # Match line number prefix like "123:  some code"
        match = re.match(r'^\s*(\d+):\s(.*)', line)
        if match:
            code_lines[int(match.group(1))] = match.group(2)
        elif line.startswith("1: /**") or line.startswith("1: ") or re.match(r'^\s*1:\s', line):
            match = re.match(r'^\s*1:\s(.*)', line)
            if match:
                code_lines[1] = match.group(1)
            else:
                code_lines[1] = line
    return code_lines

def main():
    transcript_path = r"C:\Users\micha\.gemini\antigravity-ide\brain\3a62bbfb-d2ff-4760-aefa-7638ae05594d\.system_generated\logs\transcript.jsonl"
    
    steps = {}
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                steps[data['step_index']] = data
            except:
                pass
                
    # Parse step 162 (lines 1-800)
    step_162 = steps.get(162, {})
    content_162 = step_162.get('content', '')
    code_162 = parse_view_file_content(content_162)
    print(f"Parsed Step 162: {len(code_162)} lines.")
    
    # Parse step 164 (lines 800-1282)
    step_164 = steps.get(164, {})
    content_164 = step_164.get('content', '')
    code_164 = parse_view_file_content(content_164)
    print(f"Parsed Step 164: {len(code_164)} lines.")
    
    # Combine lines
    all_lines = {}
    all_lines.update(code_162)
    all_lines.update(code_164)
    
    # Let's see if we have lines up to the end of the file.
    # In step 307 we viewed lines 1101 to 1353 of the current app.js, but let's see if there are other steps
    # that viewed lines 1200+ of the original app.js.
    # Let's find any view of lines 1280 to 1386.
    # Step 226 viewed 1340 to 1504. Let's parse step 226 as well!
    step_226 = steps.get(226, {})
    content_226 = step_226.get('content', '')
    code_226 = parse_view_file_content(content_226)
    print(f"Parsed Step 226: {len(code_226)} lines.")
    all_lines.update(code_226)
    
    # Let's write out the combined file
    max_line = max(all_lines.keys()) if all_lines else 0
    print(f"Max line index: {max_line}")
    
    output_lines = []
    for idx in range(1, max_line + 1):
        output_lines.append(all_lines.get(idx, ""))
        
    recovered_code = "\n".join(output_lines)
    with open("app.js.recovered_all", "w", encoding="utf-8") as out:
        out.write(recovered_code)
        
    print(f"Successfully wrote {max_line} lines to app.js.recovered_all")

if __name__ == '__main__':
    main()
