const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { roles: skillsDatabase, allSkillsDictionary } = require('./skillsDatabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiting Config
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Setup multer for PDF uploads (max 2MB)
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB restriction
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/analyze', apiLimiter);
app.use('/analyze-resume', apiLimiter);

// ----------------------------------------------------
// HELPER: RAG MATCHING LOGIC
// ----------------------------------------------------
function performRagAnalysis(sanitizedRole, userSkillsLowercased) {
    const availableRoles = Object.keys(skillsDatabase);
    let matchedRoleKey = availableRoles.find(r => r === sanitizedRole);

    if (!matchedRoleKey) {
        matchedRoleKey = availableRoles.find(r => sanitizedRole.includes(r) || r.includes(sanitizedRole));
    }

    if (!matchedRoleKey) {
        return { error: 'Role not found', supportedRoles: availableRoles };
    }

    // Retrieval
    const requiredSkills = skillsDatabase[matchedRoleKey];
    
    // Augmentation
    const existingSkills = [];
    const missingSkills = [];

    requiredSkills.forEach(reqSkill => {
      const isExisting = userSkillsLowercased.some(userSkill => 
        userSkill === reqSkill.toLowerCase() || 
        userSkill.includes(reqSkill.toLowerCase()) || 
        reqSkill.toLowerCase().includes(userSkill)
      );

      if (isExisting) {
        existingSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    });

    const matchPercentage = Math.round((existingSkills.length / requiredSkills.length) * 100) || 0;

    // Generation
    const suggestions = missingSkills.map(skill => {
        if (['React', 'Vue', 'HTML', 'CSS', 'Figma', 'UI Design'].some(s => skill.toLowerCase().includes(s.toLowerCase()))) {
            return `Master ${skill} to strengthen your frontend design and structural web competencies.`;
        } else if (['Node', 'Django', 'SQL', 'MongoDB', 'API', 'Docker', 'AWS', 'Python', 'Java'].some(s => skill.toLowerCase().includes(s.toLowerCase()))) {
            return `Focus on learning ${skill} to improve your backend architecture and system design abilities.`;
        } else if (['Machine Learning', 'Pandas', 'Data', 'Statistics'].some(s => skill.toLowerCase().includes(s.toLowerCase()))) {
             return `Build projects using ${skill} to solidfy your data analysis and AI capabilities.`;
        } else {
            return `Learn ${skill} as it is highly requested for ${matchedRoleKey} roles.`;
        }
    });

    if (matchPercentage === 100) {
        suggestions.unshift("Incredible! Your skill set perfectly matches the requirements.");
    } else if (matchPercentage >= 75) {
         suggestions.unshift("You're a very strong candidate. Brush up on a few missing skills to be fully prepared.");
    } else if (matchPercentage >= 40) {
        suggestions.unshift("You have a decent foundation. Focus strictly on your missing skills to bridge the gap.");
    } else {
         suggestions.unshift("Take structured courses to build these foundational skills.");
    }

    return {
        roleAnalyzed: matchedRoleKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        existingSkills,
        missingSkills,
        matchPercentage,
        suggestions
    };
}


// ----------------------------------------------------
// ROUTE 1: MANUAL SKILL ANALYZER
// ----------------------------------------------------
app.post('/analyze', (req, res) => {
  try {
    const { role, skills } = req.body;

    if (!role || typeof role !== 'string') return res.status(400).json({ error: 'Valid job role required' });
    if (!Array.isArray(skills)) return res.status(400).json({ error: 'Skills must be an array' });

    const sanitizedRole = role.toLowerCase().trim();
    const sanitizedSkills = skills.filter(s => typeof s === 'string').map(s => s.toLowerCase().trim());

    const analysis = performRagAnalysis(sanitizedRole, sanitizedSkills);
    if (analysis.error) {
        return res.status(404).json(analysis);
    }
    res.json({...analysis, extractedSkills: sanitizedSkills}); // Manual mode just returns input as extracted
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// ----------------------------------------------------
// ROUTE 2: RESUME ANALYZER (PDF UPLOAD)
// ----------------------------------------------------
app.post('/analyze-resume', upload.single('resume'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload a valid PDF resume.' });
    }

    const { targetRole } = req.body;
    if (!targetRole || typeof targetRole !== 'string') {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Target job role is required.' });
    }

    try {
        // Read and parse PDF
        let dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const resumeText = pdfData.text;

        // Cleanup the file immediately
        fs.unlinkSync(req.file.path);

        // 1. Extract Skills (Compare against our global dictionary)
        const textLower = resumeText.toLowerCase();
        // Basic tokenization with punctuation removal wrapper
        const extractedSkillsSet = new Set();
        allSkillsDictionary.forEach(dictSkill => {
            // Very naive bounded search or simple includes. Includes is fine for a hacky approach, 
            // but regex word-boundary is better to avoid 'CSS' matching inside 'accessibility' if there were no spaces.
            // Using regex word boundary. Note: Some skills contain special chars like C++, C# or Node.js.
            // Escape special chars for regex:
            const escapedSkill = dictSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
            
            if (regex.test(textLower)) {
                extractedSkillsSet.add(dictSkill);
            }
        });
        
        // Sometimes short keywords (like "Git", "CSS") match correctly with \b.
        // Fallback for tricky strings like "Node.js" where boundary might fail.
        if (textLower.includes("node.js")) extractedSkillsSet.add("node.js");
        if (textLower.includes("vue.js")) extractedSkillsSet.add("vue.js");
        if (textLower.includes("next.js")) extractedSkillsSet.add("next.js");
        if (textLower.includes("react native")) extractedSkillsSet.add("react native");

        const extractedSkills = Array.from(extractedSkillsSet);

        // 2. Extract Projects (Rule-based: Look for sentences with keywords)
        const lines = resumeText.split('\n').filter(l => l.trim().length > 10);
        const detectedProjects = [];
        const projectKeywords = ['developed', 'built', 'created', 'project:', 'project -', 'led a team', 'designed and implemented'];
        
        lines.forEach(line => {
             const lowerLine = line.toLowerCase();
             if (projectKeywords.some(keyword => lowerLine.includes(keyword)) && detectedProjects.length < 5) {
                // Ensure it's not a generic work experience tag but looks like an accomplishment
                if (line.length > 20 && line.length < 150) {
                     detectedProjects.push(line.trim());
                }
             }
        });

        // 3. Process through RAG Analysis logic
        const analysis = performRagAnalysis(targetRole.toLowerCase().trim(), extractedSkills);
        
        if (analysis.error) {
            return res.status(404).json(analysis);
        }

        // Return combined JSON
        res.json({
            ...analysis,
            extractedSkills,
            detectedProjects
        });

    } catch (error) {
        console.error("Error processing resume:", error);
        // Ensure file is deleted if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Error extracting text from PDF.' });
    }
});


// ----------------------------------------------------
// FRONTEND ROUTING
// ----------------------------------------------------
app.get('/resume-analyzer', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'resume.html'));
});

// Fallback for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running locally on http://localhost:${PORT}`);
});
