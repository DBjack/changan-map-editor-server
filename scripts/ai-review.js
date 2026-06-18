const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL =
  process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const REVIEW_SEVERITY = process.env.REVIEW_SEVERITY || 'warning';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME;
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

const SEVERITY_LEVELS = {
  none: 0,
  info: 1,
  warning: 2,
  error: 3,
};

const SEVERITY_LABELS = {
  error: { emoji: '❌', color: 'red', label: '严重错误' },
  warning: { emoji: '⚠️', color: 'orange', label: '警告' },
  info: { emoji: 'ℹ️', color: 'blue', label: '建议' },
};

function getChangedFiles() {
  try {
    const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
    const output = execSync(
      `git diff --name-only --diff-filter=ACM ${baseRef}...HEAD`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      },
    );
    return output
      .split('\n')
      .filter((file) => file.trim() && file.endsWith('.ts'));
  } catch {
    console.log('⚠️ 无法获取 git diff，将检查所有 TypeScript 文件');
    const output = execSync(
      'git ls-files --cached --others --exclude-standard',
      {
        encoding: 'utf-8',
      },
    );
    return output
      .split('\n')
      .filter((file) => file.trim() && file.endsWith('.ts'));
  }
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function callOpenAI(prompt) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [
        {
          role: 'system',
          content: `你是一位资深的 NestJS 后端代码审查专家。请审查以下代码，关注以下方面：
1. 安全性：SQL 注入、XSS、认证绕过等安全漏洞
2. 代码质量：代码结构、命名规范、可读性、重复代码
3. 最佳实践：是否符合 NestJS 最佳实践、TypeScript 规范
4. 性能：潜在的性能问题、N+1 查询等
5. 错误处理：异常处理是否完善
6. 类型安全：TypeScript 类型定义是否正确

请以 JSON 格式输出审查结果，格式如下：
{
  "issues": [
    {
      "file": "文件名",
      "line": 行号,
      "severity": "info" | "warning" | "error",
      "title": "问题标题",
      "description": "问题详细描述",
      "suggestion": "修复建议"
    }
  ]
}

只输出 JSON，不要包含其他文本。`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 调用失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseReviewResult(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { issues: [] };
  } catch {
    return { issues: [] };
  }
}

function printIssues(issues) {
  if (issues.length === 0) {
    console.log('\n✅ AI 代码审查通过，未发现问题');
    return;
  }

  console.log('\n🔍 AI 代码审查结果：');
  console.log('='.repeat(80));

  const groupedIssues = issues.reduce((acc, issue) => {
    acc[issue.file] = acc[issue.file] || [];
    acc[issue.file].push(issue);
    return acc;
  }, {});

  let hasCriticalIssue = false;
  const minSeverity = SEVERITY_LEVELS[REVIEW_SEVERITY];

  Object.entries(groupedIssues).forEach(([file, fileIssues]) => {
    console.log(`\n📁 ${file}`);
    fileIssues.forEach((issue) => {
      const level = SEVERITY_LEVELS[issue.severity] || 0;
      const isCritical = level >= minSeverity;

      if (isCritical) {
        hasCriticalIssue = true;
      }

      const color =
        issue.severity === 'error'
          ? '\x1b[31m'
          : issue.severity === 'warning'
            ? '\x1b[33m'
            : '\x1b[36m';
      const reset = '\x1b[0m';

      console.log(
        `\n${color}[${issue.severity.toUpperCase()}]${reset} 第 ${issue.line} 行`,
      );
      console.log(`  📝 ${issue.title}`);
      console.log(`  💬 ${issue.description}`);
      console.log(`  ✨ ${issue.suggestion}`);
    });
  });

  console.log('\n' + '='.repeat(80));

  if (hasCriticalIssue) {
    console.log(
      `\n❌ 发现 ${issues.filter((i) => SEVERITY_LEVELS[i.severity] >= minSeverity).length} 个严重问题`,
    );
  }

  return hasCriticalIssue;
}

function generateMarkdownComment(issues) {
  if (issues.length === 0) {
    return `## 🤖 AI 代码审查结果

✅ **审查通过！** AI 未发现任何问题。

---

*由 AI 代码审查工具自动生成*`;
  }

  const groupedIssues = issues.reduce((acc, issue) => {
    acc[issue.file] = acc[issue.file] || [];
    acc[issue.file].push(issue);
    return acc;
  }, {});

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let comment = `## 🤖 AI 代码审查结果

### 📊 统计
| 类型 | 数量 |
|------|------|
| ❌ 错误 | ${errorCount} |
| ⚠️ 警告 | ${warningCount} |
| ℹ️ 建议 | ${infoCount} |

---

`;

  Object.entries(groupedIssues).forEach(([file, fileIssues]) => {
    comment += `### 📁 ${file}\n\n`;
    fileIssues.forEach((issue) => {
      const label = SEVERITY_LABELS[issue.severity] || SEVERITY_LABELS.info;
      comment += `**${label.emoji} [${label.label}]** \`第 ${issue.line} 行\`\n\n`;
      comment += `**问题**: ${issue.title}\n\n`;
      comment += `**描述**: ${issue.description}\n\n`;
      comment += `**建议**: ${issue.suggestion}\n\n`;
      comment += `---\n\n`;
    });
  });

  comment += `*由 AI 代码审查工具自动生成*`;

  return comment;
}

async function getPullRequestNumber() {
  if (GITHUB_EVENT_NAME !== 'pull_request') {
    return null;
  }

  try {
    if (GITHUB_EVENT_PATH && fs.existsSync(GITHUB_EVENT_PATH)) {
      const eventData = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf-8'));
      return eventData.pull_request?.number;
    }

    const output = execSync('git log --oneline -1', { encoding: 'utf-8' });
    const prMatch = output.match(/#(\d+)/);
    if (prMatch) {
      return parseInt(prMatch[1], 10);
    }
  } catch {
    console.log('⚠️ 无法获取 PR 编号');
  }

  return null;
}

async function postGitHubComment(prNumber, comment) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log('⚠️ GITHUB_TOKEN 或 GITHUB_REPOSITORY 未设置，跳过评论');
    return;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${prNumber}/comments`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`评论失败: ${error.message}`);
    }

    console.log(`✅ 已成功在 PR #${prNumber} 上发表评论`);
  } catch (error) {
    console.log(`⚠️ 发表评论失败: ${error.message}`);
  }
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY 未设置，跳过 AI 审查');
    process.exit(0);
  }

  console.log('🚀 开始 AI 代码审查...');

  const files = getChangedFiles();
  console.log(`📋 待审查文件数: ${files.length}`);

  if (files.length === 0) {
    console.log('✅ 没有需要审查的文件');
    process.exit(0);
  }

  const batchSize = 3;
  let allIssues = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(
      `\n🔄 正在审查第 ${Math.floor(i / batchSize) + 1} 批文件: ${batch.join(', ')}`,
    );

    const fileContents = batch
      .map((file) => {
        const content = readFileContent(file);
        return content ? `--- ${file} ---\n${content}\n` : null;
      })
      .filter(Boolean);

    if (fileContents.length === 0) continue;

    const prompt = `请审查以下 NestJS 代码文件：\n\n${fileContents.join('\n')}`;

    try {
      const result = await callOpenAI(prompt);
      const parsed = parseReviewResult(result);
      allIssues = [...allIssues, ...parsed.issues];
    } catch (error) {
      console.log(`⚠️ 审查失败: ${error.message}`);
    }
  }

  const hasCriticalIssue = printIssues(allIssues);

  if (GITHUB_EVENT_NAME === 'pull_request') {
    const prNumber = await getPullRequestNumber();
    if (prNumber) {
      const comment = generateMarkdownComment(allIssues);
      await postGitHubComment(prNumber, comment);
    }
  }

  if (hasCriticalIssue) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ AI 审查脚本执行失败:', error.message);
  process.exit(1);
});
