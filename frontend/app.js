document.addEventListener('DOMContentLoaded', () => {
    // State
    let skills = [];

    // DOM Elements
    const form = document.getElementById('analyzer-form');
    const roleInput = document.getElementById('job-role');
    const skillInput = document.getElementById('skill-input');
    const tagsContainer = document.getElementById('tags-container');
    const analyzeBtn = document.getElementById('analyze-btn');
    const errorMsg = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');
    
    // Result DOM Elements
    const analyzedRoleBadge = document.getElementById('analyzed-role-badge');
    const circularProgress = document.getElementById('circular-progress');
    const progressValue = document.getElementById('progress-value');
    const existingSkillsGrid = document.getElementById('existing-skills-grid');
    const missingSkillsGrid = document.getElementById('missing-skills-grid');
    const existingCount = document.getElementById('existing-count');
    const missingCount = document.getElementById('missing-count');
    const suggestionsList = document.getElementById('suggestions-list');

    // Only run if the elements exist (manual analyzer page)
    if (!form || !skillInput) return;

    tagsContainer.addEventListener('click', (e) => {
        if(e.target === tagsContainer) skillInput.focus();
    });

    skillInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = skillInput.value.trim();
            if (value && !skills.includes(value)) {
                addSkillTag(value);
                skillInput.value = '';
            }
        }
    });

    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag')) {
            const skillToRemove = e.target.getAttribute('data-skill');
            skills = skills.filter(skill => skill !== skillToRemove);
            e.target.parentElement.remove();
        }
    });

    function addSkillTag(skill) {
        skills.push(skill);
        const tag = document.createElement('span');
        tag.classList.add('tag');
        tag.innerHTML = `${skill} <span class="remove-tag" data-skill="${skill}">&times;</span>`;
        tagsContainer.insertBefore(tag, skillInput);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = roleInput.value.trim();
        
        if (!role) return showError("Please enter a target job role.");

        if (skills.length === 0) {
            const pendingSkill = skillInput.value.trim();
            if (pendingSkill) {
                addSkillTag(pendingSkill);
                skillInput.value = '';
            } else {
                return showError("Please enter at least one current skill.");
            }
        }

        hideError();
        setLoadingState(true);

        try {
            const response = await fetch('http://107.23.94.11:3000/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, skills })
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
        existingCount.textContent = `(${data.existingSkills.length})`;
        missingCount.textContent = `(${data.missingSkills.length})`;

        populateGrid(existingSkillsGrid, data.existingSkills, 'tag-success');
        populateGrid(missingSkillsGrid, data.missingSkills, 'tag-danger');

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
