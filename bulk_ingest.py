import os
import subprocess
import re
import json

def ingest_mp4_files(directory_path):
    with open('./data/mp4_names.json', 'r') as infile:
        data = json.load(infile)
        
    ingested_count, error_count = 0, 0
    for filename in os.listdir(directory_path):
        print(filename)
        if filename in data:
            continue
        
        file_path = os.path.join(directory_path, filename)
        if os.path.isfile(file_path) and filename.lower().endswith('.mp4'):
            command = [
                'node', 'SimpleIngest.js',
                '--libraryId', 'ilib4JvLVStm2pDMa89332h8tNqUCZvY',
                '--title', 'Sample Media',
                '--files', file_path
            ]
            
            with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as process:
                object_id = None
                for line in process.stdout:
                    print(line, end='')
                    match = re.search(r'Object ID:\s+(\S+)', line)
                    if match:
                        object_id = match.group(1)
                
                stderr_output = process.stderr.read()
                return_code = process.wait()
                
                if return_code == 0 and object_id:
                    data[filename] = object_id
                    ingested_count += 1
                else:
                    print(f"Error processing file {filename}: {stderr_output}")
                    error_count += 1
            with open('./data/mp4_names.json', 'w') as json_file:
                json.dump(data, json_file, indent=4)
            print(f"Successfully ingested {ingested_count} files, Failed to ingest {error_count} files")
                    
                

if __name__ == '__main__':
    directory_path = input("Enter the path to the directory: ")
    ingest_mp4_files(directory_path)
