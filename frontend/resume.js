document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('resume-form');
    const roleInput = document.getElementById('job-role');
    const fileInput = document.getElementById('resume-input');
    const dropzone = document.getElementById('dropzone');
    const dropzoneText = document.getElementById('dropzone-text');
    const analyzeBtn = document.getElementById('analyze-btn');
    const errorMsg = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');
    
    // Result DOM Elements
    const analyzedRoleBadge = document.getElementById('analyzed-role-badge');
    const circularProgress = document.getElementById('circular-progress');
    const progressValue = document.getElementById('progress-value');
    
    const extractedSkillsGrid = document.getElementById('extracted-skills-grid');
    const existingSkillsGrid = document.getElementById('existing-skills-grid');
    const missingSkillsGrid = document.getElementById('missing-skills-grid');
    
    const extractedCount = document.getElementById('extracted-count');
    const existingCount = document.getElementById('existing-count');
    const missingCount = document.getElementById('missing-count');
    
    const projectsContainer = document.getElementById('projects-container');
    const projectsList = document.getElementById('projects-list');
    const suggestionsList = document.getElementById('suggestions-list');

    if (!form || !fileInput) return;

    // File Drag and Drop functionality
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
            fileInput.files = e.dataTransfer.files; // Assign to input
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    function handleFileSelection(file) {
        if (file.type !== "application/pdf") {
            showError("Only PDF files are supported!");
            dropzone.classList.remove('has-file');
            dropzoneText.textContent = "Drag & Drop your resume here";
            fileInput.value = ''; // Reset
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showError("File is too large. Max size is 2MB.");
            dropzone.classList.remove('has-file');
            dropzoneText.textContent = "Drag & Drop your resume here";
            fileInput.value = ''; // Reset
            return;
        }

        hideError();
        dropzone.classList.add('has-file');
        dropzoneText.innerHTML = `<strong>Selected:</strong> ${file.name}`;
    }

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const role = roleInput.value.trim();
        const file = fileInput.files[0];

        if (!role) return showError("Please enter a target job role.");
        if (!file) return showError("Please upload your PDF resume.");

        hideError();
        setLoadingState(true);

        const formData = new FormData();
        formData.append('targetRole', role);
        formData.append('resume', file);

        try {
            const response = await fetch('http://107.23.94.11:3000/analyze', {
                method: 'POST',
                body: formData // No Headers content-type required for FormData (browser sets boundary)
            });

            const data = await response.json();

            if (!response.ok) {
                let msg = data.error || "Analysis failed.";
                if (data.supportedRoles) {
                    msg += `<br><strong>Supported Roles:</strong> ${data.supportedRoles.join(', ')}`;
                }
                throw new Error(msg);
            }

            renderResults(data);

        } catch (error) {
            showError(error.message);
            resultsSection.classList.add('hidden');
        } finally {
            setLoadingState(false);
        }
    });

    function renderResults(data) {
        resultsSection.classList.remove('hidden');

        analyzedRoleBadge.textContent = data.roleAnalyzed;
        
        extractedCount.textContent = `(${data.extractedSkills.length})`;
        existingCount.textContent = `(${data.existingSkills.length})`;
        missingCount.textContent = `(${data.missingSkills.length})`;

        populateGrid(extractedSkillsGrid, data.extractedSkills, 'tag-info');
        populateGrid(existingSkillsGrid, data.existingSkills, 'tag-success');
        populateGrid(missingSkillsGrid, data.missingSkills, 'tag-danger');

        // Detected Projects
        if (data.detectedProjects && data.detectedProjects.length > 0) {
            projectsContainer.style.display = 'block';
            projectsList.innerHTML = '';
            data.detectedProjects.forEach(proj => {
                const p = document.createElement('div');
                p.className = 'project-card';
                // Very basic truncation to keep UI clean if they have massive blobs
                p.textContent = proj.length > 200 ? proj.substring(0, 200) + '...' : proj;
                projectsList.appendChild(p);
            });
        } else {
            projectsContainer.style.display = 'none';
        }

        // Suggestions
        suggestionsList.innerHTML = '';
        data.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            suggestionsList.appendChild(li);
        });

        animateProgress(data.matchPercentage);
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function populateGrid(gridElement, items, className) {
        gridElement.innerHTML = '';
        if (items.length === 0) {
            gridElement.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">None.</span>';
            return;
        }
        items.forEach(item => {
            const el = document.createElement('span');
            el.className = `result-tag ${className}`;
            el.textContent = item;
            gridElement.appendChild(el);
        });
    }

    function animateProgress(targetPercent) {
        let currentPercent = 0;
        const duration = 1000;
        const intervalTime = 15;
        const step = targetPercent / (duration / intervalTime);
        
        let progressColor = '#ef4444'; // Red
        if (targetPercent >= 75) progressColor = '#22c55e'; // Green
        else if (targetPercent >= 40) progressColor = '#eab308'; // Yellow

        // Reset
        circularProgress.style.background = `conic-gradient(${progressColor} 0deg, #1f2937 0deg)`;

        if (targetPercent === 0) {
             progressValue.textContent = '0%';
             return;
        }

        const timer = setInterval(() => {
            currentPercent += step;
            if (currentPercent >= targetPercent) {
                currentPercent = targetPercent;
                clearInterval(timer);
            }
            
            const degrees = currentPercent * 3.6;
            progressValue.textContent = `${Math.round(currentPercent)}%`;
            circularProgress.style.background = `conic-gradient(${progressColor} ${degrees}deg, #1f2937 0deg)`;
        }, intervalTime);
    }

    function setLoadingState(isLoading) {
        analyzeBtn.disabled = isLoading;
        if (isLoading) analyzeBtn.classList.add('btn-loading');
        else analyzeBtn.classList.remove('btn-loading');
    }

    function showError(message) {
        errorMsg.innerHTML = message;
        errorMsg.style.display = 'block';
    }

    function hideError() {
        errorMsg.textContent = '';
        errorMsg.style.display = 'none';
    }
});
