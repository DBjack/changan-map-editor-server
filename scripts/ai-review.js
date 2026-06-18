const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const AI_API_KEY = process.env.AI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1';
const REVIEW_SEVERITY = process.env.REVIEW_SEVERITY || 'warning';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME;
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_COMPATIBLE_API_URL =
  process.env.AI_API_URL ||
  process.env.OPENAI_API_URL ||
  'https://api.openai.com/v1/chat/completions';
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const AI_REQUEST_TIMEOUT_MS = getRequestTimeoutMs();
const AI_REVIEW_ALL_FILES = process.env.AI_REVIEW_ALL_FILES === 'true';

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

function getRequestTimeoutMs() {
  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0
    ? timeout
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`API 调用超时: ${AI_REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getChangedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
  const localStrategies = [
    {
      name: '工作区未提交变更',
      command: 'git diff --name-only --diff-filter=ACM',
    },
    {
      name: '暂存区变更',
      command: 'git diff --cached --name-only --diff-filter=ACM',
    },
    {
      name: '未跟踪文件',
      command: 'git ls-files --others --exclude-standard',
    },
  ];
  const githubStrategies = [
    {
      name: '增量审查',
      command: `git diff --name-only --diff-filter=ACM ${baseRef}...HEAD`,
    },
    {
      name: '最近一次提交',
      command: 'git diff --name-only --diff-filter=ACM HEAD~1...HEAD',
    },
  ];
  const strategies = GITHUB_EVENT_NAME ? githubStrategies : localStrategies;

  for (const strategy of strategies) {
    try {
      const output = execSync(strategy.command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const changedFiles = output
        .split('\n')
        .filter((file) => file.trim() && file.endsWith('.ts'));

      if (changedFiles.length > 0) {
        console.log(
          `📋 待审查文件数: ${changedFiles.length}（${strategy.name}）`,
        );
        return changedFiles;
      }
    } catch (error) {
      console.log(`⚠️ ${strategy.name}失败: ${error.message}`);
    }
  }

  if (!AI_REVIEW_ALL_FILES) {
    console.log(
      '✅ 未找到需要审查的 TypeScript 变更文件（如需全量审查，设置 AI_REVIEW_ALL_FILES=true）',
    );
    return [];
  }

  console.log('⚠️ AI_REVIEW_ALL_FILES=true，检查所有 TypeScript 文件');
  const output = execSync('git ls-files --cached --others --exclude-standard', {
    encoding: 'utf-8',
  });
  const allFiles = output
    .split('\n')
    .filter((file) => file.trim() && file.endsWith('.ts'));

  console.log(`📋 待审查文件数: ${allFiles.length}（全量审查）`);
  return allFiles;
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function callAI(prompt) {
  try {
    const systemPrompt = `你是一位资深的 NestJS 后端代码审查专家。请审查以下代码，关注以下方面：
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

只输出 JSON，不要包含其他文本。`;

    if (AI_PROVIDER === 'gemini') {
      const model = process.env.AI_MODEL || DEFAULT_GEMINI_MODEL;
      const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${model}:generateContent`;
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': AI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: systemPrompt }],
            },
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = `Gemini API 调用失败: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
          }
        } catch {
          const text = await response.text();
          if (text) {
            errorMessage += ` - ${text.substring(0, 200)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content ||
        !data.candidates[0].content.parts
      ) {
        throw new Error('Gemini API 返回格式不正确');
      }
      return data.candidates[0].content.parts.map((p) => p.text).join('');
    }

    const url = OPENAI_COMPATIBLE_API_URL;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API 调用失败: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
        }
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage += ` - ${text.substring(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API 返回格式不正确');
    }
    return data.choices[0].message.content;
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      const url =
        AI_PROVIDER === 'gemini'
          ? 'generativelanguage.googleapis.com'
          : OPENAI_COMPATIBLE_API_URL;
      throw new Error(`网络连接失败: ${error.code} - ${url}`);
    }
    throw error;
  }
}

function parseReviewResult(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回内容中未找到 JSON');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('AI 返回内容不是有效 JSON');
  }
}

function isAuthFailure(error) {
  return /\b(401 Unauthorized|403 Forbidden)\b/.test(error.message);
}

function isTimeoutFailure(error) {
  return error.message.includes('API 调用超时');
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
    const response = await fetchWithTimeout(url, {
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
  if (!AI_API_KEY) {
    console.log('⚠️ AI_API_KEY 未设置，跳过 AI 审查');
    process.exit(0);
  }

  console.log(`🚀 开始 AI 代码审查... (Provider: ${AI_PROVIDER})`);

  const files = getChangedFiles();

  if (files.length === 0) {
    console.log('✅ 没有需要审查的文件');
    process.exit(0);
  }

  const batchSize = 3;
  let allIssues = [];
  let reviewFailures = 0;

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
      const result = await callAI(prompt);
      const parsed = parseReviewResult(result);
      if (!Array.isArray(parsed.issues)) {
        throw new Error('AI 返回 JSON 缺少 issues 数组');
      }
      allIssues = [...allIssues, ...parsed.issues];
    } catch (error) {
      reviewFailures += 1;
      console.log(`⚠️ 审查失败: ${error.message}`);
      if (isAuthFailure(error) || isTimeoutFailure(error)) {
        const reason = isAuthFailure(error)
          ? 'AI 凭证不可用'
          : 'AI API 响应超时';
        console.log(`⚠️ ${reason}，停止后续批次审查`);
        break;
      }
    }
  }

  let hasCriticalIssue = false;
  if (allIssues.length > 0 || reviewFailures === 0) {
    hasCriticalIssue = printIssues(allIssues);
  }

  if (reviewFailures > 0) {
    console.log(
      `\n❌ 有 ${reviewFailures} 个批次审查失败，请先修复 AI 调用或返回格式问题`,
    );
    console.log(
      '   可检查 AI_API_KEY、AI_MODEL、网络代理，或临时设置 AI_REQUEST_TIMEOUT_MS 调整等待时间',
    );
  }

  if (GITHUB_EVENT_NAME === 'pull_request') {
    const prNumber = await getPullRequestNumber();
    if (prNumber) {
      const comment = generateMarkdownComment(allIssues);
      await postGitHubComment(prNumber, comment);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ AI 审查脚本执行失败:', error.message);
  process.exit(1);
});
