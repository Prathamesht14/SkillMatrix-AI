const roles = {
  "frontend developer": ["HTML", "CSS", "JavaScript", "React", "Git", "TypeScript", "Tailwind CSS", "Vue.js", "Web Performance", "Next.js"],
  "backend developer": ["Node.js", "Express", "MongoDB", "REST API", "SQL", "PostgreSQL", "Docker", "Git", "Redis", "Python", "Java", "Spring Boot"],
  "full stack developer": ["HTML", "CSS", "JavaScript", "React", "Node.js", "Express", "MongoDB", "Git", "SQL", "Docker", "TypeScript", "AWS"],
  "data scientist": ["Python", "Pandas", "Machine Learning", "Statistics", "SQL", "Jupyter", "TensorFlow", "Scikit-Learn", "R", "Data Visualization"],
  "data analytics": ["SQL", "Excel", "Tableau", "Power BI", "Python", "Data Visualization", "Data Cleaning", "Statistics"],
  "java developer": ["Java", "Spring Boot", "Hibernate", "Microservices", "REST API", "SQL", "Git", "Docker", "JUnit", "Maven"],
  "devops engineer": ["Linux", "Docker", "Kubernetes", "AWS", "CI/CD", "Git", "Bash", "Terraform", "Jenkins", "Ansible"],
  "mobile developer": ["Swift", "Kotlin", "React Native", "Flutter", "Git", "Mobile UI", "API Integration", "iOS", "Android"],
  "ui/ux designer": ["Figma", "Sketch", "Adobe XD", "Wireframing", "Prototyping", "User Research", "UI Design", "CSS", "Accessibility"],
  "product manager": ["Agile", "Scrum", "Product Roadmap", "Jira", "User Stories", "Data Analysis", "Communication"]
};

// Create a flat dictionary of all unique skills (lowercased) for fast text extraction from resumes
const allSkillsDictionary = Array.from(new Set(Object.values(roles).flat().map(s => s.toLowerCase())));

module.exports = { roles, allSkillsDictionary };
