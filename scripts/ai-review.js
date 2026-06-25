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
const CI_PROJECT_PATH = process.env.CI_PROJECT_PATH;
const CI_COMMIT_REF_NAME = process.env.CI_COMMIT_REF_NAME;
const CI_PIPELINE_SOURCE = process.env.CI_PIPELINE_SOURCE;
const CI_MERGE_REQUEST_TARGET_BRANCH_NAME =
  process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_COMPATIBLE_API_URL =
  process.env.AI_API_URL ||
  process.env.OPENAI_API_URL ||
  'https://api.openai.com/v1/chat/completions';
const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
const AI_REQUEST_TIMEOUT_MS = getRequestTimeoutMs();
const AI_REVIEW_ALL_FILES = process.env.AI_REVIEW_ALL_FILES === 'true';

function maskSecret(secret) {
  if (!secret) return '未设置';
  if (secret.length <= 8) return '****';
  return secret.slice(0, 4) + '****' + secret.slice(-4);
}

function validateApiKey(key) {
  if (!key) {
    return { valid: false, message: 'API Key 未设置' };
  }
  if (!/^sk-[A-Za-z0-9]{20,}$/.test(key)) {
    return { valid: false, message: 'API Key 格式不正确' };
  }
  return { valid: true, message: '' };
}

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
  const baseRef =
    process.env.GITHUB_BASE_REF ||
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ||
    'origin/main';
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
  const gitlabStrategies = [
    {
      name: 'GitLab MR 增量审查',
      command: `git diff --name-only --diff-filter=ACM ${baseRef}...HEAD`,
    },
    {
      name: 'GitLab 分支提交',
      command: 'git diff --name-only --diff-filter=ACM HEAD~1...HEAD',
    },
  ];
  let strategies;
  if (GITHUB_EVENT_NAME) {
    strategies = githubStrategies;
  } else if (CI_PIPELINE_SOURCE) {
    strategies = gitlabStrategies;
  } else {
    strategies = localStrategies;
  }

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
  let cleanedContent = content.trim();

  cleanedContent = cleanedContent.replace(/^```json\s*/i, '');
  cleanedContent = cleanedContent.replace(/\s*```$/i, '');
  cleanedContent = cleanedContent.replace(/^```\s*/, '');
  cleanedContent = cleanedContent.replace(/\s*```$/, '');

  const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `AI 返回内容中未找到 JSON，原始响应: ${content.substring(0, 500)}`,
    );
  }

  let jsonString = jsonMatch[0];

  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
    jsonString = jsonString.replace(/([^\\])'/g, '$1"');

    try {
      return JSON.parse(jsonString);
    } catch (secondParseError) {
      throw new Error(
        `AI 返回内容不是有效 JSON，错误: ${parseError.message}，第二次解析错误: ${secondParseError.message}，原始响应: ${content.substring(0, 500)}`,
      );
    }
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
  if (GITHUB_EVENT_NAME === 'pull_request') {
    try {
      if (GITHUB_EVENT_PATH && fs.existsSync(GITHUB_EVENT_PATH)) {
        const eventData = JSON.parse(
          fs.readFileSync(GITHUB_EVENT_PATH, 'utf-8'),
        );
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
  }

  return null;
}

function getMergeRequestIid() {
  return process.env.CI_MERGE_REQUEST_IID;
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

async function postGitLabComment(mrIid, comment) {
  const gitlabToken = process.env.GITLAB_TOKEN;
  const projectId = process.env.CI_PROJECT_ID;

  if (!gitlabToken || !projectId) {
    console.log('⚠️ GITLAB_TOKEN 或 CI_PROJECT_ID 未设置，跳过评论');
    return;
  }

  const url = `https://gitlab.com/api/v4/projects/${projectId}/merge_requests/${mrIid}/notes`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gitlabToken}`,
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`评论失败: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`✅ 已成功在 MR #${mrIid} 上发表评论`);
  } catch (error) {
    console.log(`⚠️ 发表评论失败: ${error.message}`);
  }
}

async function main() {
  const keyValidation = validateApiKey(AI_API_KEY);
  if (!keyValidation.valid) {
    console.log(`⚠️ ${keyValidation.message}，跳过 AI 审查`);
    console.log(`   当前 API Key: ${maskSecret(AI_API_KEY)}`);
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
    console.log(`   当前 API Key: ${maskSecret(AI_API_KEY)}`);
    console.log(
      '   可检查 API Key、模型配置、网络代理，或临时设置 AI_REQUEST_TIMEOUT_MS 调整等待时间',
    );
  }

  if (GITHUB_EVENT_NAME === 'pull_request') {
    const prNumber = await getPullRequestNumber();
    if (prNumber) {
      const comment = generateMarkdownComment(allIssues);
      await postGitHubComment(prNumber, comment);
    }
  }

  if (CI_PIPELINE_SOURCE === 'merge_request_event') {
    const mrIid = getMergeRequestIid();
    if (mrIid) {
      const comment = generateMarkdownComment(allIssues);
      await postGitLabComment(mrIid, comment);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ AI 审查脚本执行失败:', error.message);
  process.exit(1);
});
