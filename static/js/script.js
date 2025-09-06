// static/js/script.js

document.addEventListener("DOMContentLoaded", () => {
    const atsForm = document.getElementById("ats-form");
    const submitBtn = document.getElementById("submit-btn");
    const resultsContainer = document.getElementById("results-container");
    const resultsContent = document.getElementById("results-content");
    const errorContainer = document.getElementById("error-container");
    const loader = document.getElementById("loader");

    atsForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent default form submission

        // Get form data
        const jd = document.getElementById("jd").value;
        const resumeFile = document.getElementById("resume").files[0];

        // Basic validation
        if (!jd.trim() || !resumeFile) {
            showError("Please provide both a job description and a resume file.");
            return;
        }

        // Prepare for API call
        showLoader(true);
        clearResults();
        submitBtn.disabled = true;
        submitBtn.textContent = "Analyzing...";

        // Create FormData to send file and text
        const formData = new FormData();
        formData.append("jd", jd);
        formData.append("resume", resumeFile);

        try {
            // Fetch API to call our backend
            const response = await fetch("/evaluate", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            // Debug logging
            console.log('API Response:', result);

            if (!response.ok) {
                // Handle server-side errors (e.g., Gemini API fails)
                if (result.raw_response) {
                    throw new Error(`${result.error}: ${result.raw_response}`);
                } else {
                    throw new Error(result.error || "An unknown error occurred.");
                }
            }

            // Display the results
            displayResults(result);

        } catch (error) {
            showError(`Error: ${error.message}`);
        } finally {
            // Reset UI
            showLoader(false);
            submitBtn.disabled = false;
            submitBtn.textContent = "Evaluate My Resume";
        }
    });

    function showLoader(isLoading) {
        resultsContainer.classList.remove("hidden");
        loader.classList.toggle("hidden", !isLoading);
        resultsContent.classList.toggle("hidden", isLoading);
    }

    function displayResults(data) {
        resultsContent.innerHTML = `
            <div class="result-item">
                <h3>✅ JD Match</h3>
                <p><strong>${data['JD Match'] || 'Not available'}</strong></p>
            </div>
            <div class="result-item">
                <h3>❌ Missing Keywords</h3>
                <div class="keywords">
                    ${(data.MissingKeywords && data.MissingKeywords.length > 0)
                        ? data.MissingKeywords.map(kw => `<span class="keyword">${kw}</span>`).join('')
                        : '<p>No missing keywords found. Great job!</p>'}
                </div>
            </div>
            <div class="result-item profile-summary-item">
                <h3>📝 Profile Summary & Actionable Feedback</h3>
                <p>${data['Profile Summary'] || 'No summary provided.'}</p>
            </div>
        `;
        errorContainer.classList.add("hidden");
    }

    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.classList.remove("hidden");
        resultsContainer.classList.add("hidden");
    }

    function clearResults() {
        resultsContent.innerHTML = "";
        errorContainer.classList.add("hidden");
    }
});
