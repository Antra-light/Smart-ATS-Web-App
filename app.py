# app.py
import os
import json
import PyPDF2 as pdf
from dotenv import load_dotenv
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask import render_template

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Load environment variables and configure the Gemini API
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# --- Your existing helper functions ---

def get_gemini_repsonse(input_text):
    """Calls the Gemini model to get the evaluation."""
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(input_text)
    return response.text

def input_pdf_text(uploaded_file):
    """Extracts text from the uploaded PDF file."""
    # Note: uploaded_file is now a file stream from Flask
    reader = pdf.PdfReader(uploaded_file)
    text = ""
    for page in reader.pages:
        text += str(page.extract_text())
    return text

# --- Prompt Template ---
# Refined prompt for better JSON output
input_prompt = """
You are an expert ATS (Application Tracking System) evaluator and career coach with 10+ years of experience in tech recruitment. Analyze the resume against the job description and provide ONLY a valid JSON response.

IMPORTANT: Return ONLY the JSON object, no other text, no explanations, no markdown formatting.

Required JSON format:
{{
  "JD Match": "85%",
  "MissingKeywords": ["keyword1", "keyword2"],
  "Profile Summary": "Provide a comprehensive 4-5 sentence analysis that: 1) Starts with a clear match percentage assessment and overall fit evaluation, 2) Highlights 2-3 specific strengths from the resume that directly align with the job requirements, 3) Identifies 2-3 specific gaps or areas for improvement with concrete examples, 4) Provides 2-3 actionable recommendations for resume enhancement (e.g., 'Add a project showcasing Python skills', 'Include specific metrics for achievements'), 5) Ends with a motivational note about the candidate's potential. Use specific examples from both the resume and JD to make feedback concrete and actionable."
}}

Resume text: {text}

Job Description: {jd}

Remember: Return ONLY the JSON object, nothing else. Make the Profile Summary detailed, specific, and actionable with concrete examples.
"""

@app.route('/evaluate', methods=['POST'])
def evaluate_resume():
    """The main API endpoint to handle resume evaluation."""
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file part"}), 400
    
    resume_file = request.files['resume']
    jd = request.form.get('jd', '')

    if resume_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if jd == '':
        return jsonify({"error": "No job description provided"}), 400

    try:
        # Process the resume and call the Gemini API
        resume_text = input_pdf_text(resume_file)
        prompt = input_prompt.format(text=resume_text, jd=jd)
        response_text = get_gemini_repsonse(prompt)
        
        # Clean the response text
        cleaned_response = response_text.strip()
        
        # Remove any markdown code blocks if present
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith('```'):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        
        cleaned_response = cleaned_response.strip()
        
        # Find JSON object boundaries
        start_index = cleaned_response.find('{')
        end_index = cleaned_response.rfind('}') + 1
        
        if start_index == -1 or end_index == 0:
            # If '{' or '}' is not found, try to create a fallback response
            return jsonify({
                "error": "AI response format issue",
                "raw_response": cleaned_response[:200] + "..." if len(cleaned_response) > 200 else cleaned_response
            }), 500
            
        json_str = cleaned_response[start_index:end_index]
        
        # Try to parse the JSON
        try:
            response_json = json.loads(json_str)
            
            # Validate required fields
            required_fields = ["JD Match", "MissingKeywords", "Profile Summary"]
            for field in required_fields:
                if field not in response_json:
                    response_json[field] = "Not available" if field == "Profile Summary" else []
            
            return jsonify(response_json)
            
        except json.JSONDecodeError as json_err:
            # If JSON parsing fails, return a structured error with the raw response
            return jsonify({
                "error": "Invalid JSON response from AI",
                "raw_response": json_str[:200] + "..." if len(json_str) > 200 else json_str,
                "json_error": str(json_err)
            }), 500

    except Exception as e:
        # Handle other potential errors
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html') 

# --- Main execution ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)