import json
import re

def restore():
    # Load step 208 dump
    with open("step_208_dump.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    content = data.get("content", "")
    if not content:
        # Check tool_calls or system response if content is empty
        # Wait, VIEW_FILE tool output is in the system message or step content
        print("No content field found. Let's inspect data keys.")
        print(data.keys())
        return
    
    # The content of VIEW_FILE looks like:
    # "Created At: ...\nCompleted At: ...\nFile Path: ...\nTotal Lines: ...\nShowing lines 1 to ...\nThe following code has been modified to include a line number...\n1: /**\n2:  * AeroPay..."
    
    lines = content.splitlines()
    recovered_lines = []
    
    # Find where the code lines start
    code_started = False
    for line in lines:
        if code_started:
            # Match line number prefix like "123:  some code"
            match = re.match(r'^\s*(\d+):\s(.*)', line)
            if match:
                recovered_lines.append(match.group(2))
            else:
                # If it doesn't match the prefix, it might be an empty line or something else
                # but usually it matches
                recovered_lines.append(line)
        elif line.startswith("1: /**") or line.startswith("1: ") or re.match(r'^\s*1:\s', line):
            code_started = True
            match = re.match(r'^\s*1:\s(.*)', line)
            if match:
                recovered_lines.append(match.group(1))
            else:
                recovered_lines.append(line)
                
    if not recovered_lines:
        print("Could not parse code lines.")
        return
        
    recovered_code = "\n".join(recovered_lines)
    with open("app.js.recovered", "w", encoding="utf-8") as out:
        out.write(recovered_code)
    print(f"Recovered {len(recovered_lines)} lines to app.js.recovered")

if __name__ == '__main__':
    restore()
