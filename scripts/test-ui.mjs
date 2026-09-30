// npm test 검사 실행과 터미널 대시보드 출력을 담당합니다.
import React, {useEffect, useState} from 'react';
import {Box, Text, Static, render, useApp, useWindowSize} from 'ink';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const h = React.createElement;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = process.platform === 'win32' ? 'python' : 'python3';
const checks = [
  {label: 'JavaScript syntax', command: process.execPath, args: ['--check', 'app.js']},
  {label: 'Site integrity', command: python, args: ['scripts/check_site.py']},
  {label: 'Browser / WebMCP', command: python, args: ['scripts/check_browser.py']},
];

function runCheck(check, onLine) {
  return new Promise(resolve => {
    const child = spawn(check.command, check.args, {
      cwd: root,
      env: {...process.env, PYTHONUTF8: '1'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let pending = '';
    const consume = chunk => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      lines.filter(Boolean).forEach(onLine);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.on('error', error => {
      onLine(error.message);
      resolve(1);
    });
    child.on('close', code => {
      if (pending.trim()) onLine(pending.trim());
      resolve(code ?? 1);
    });
  });
}

function Panel({title, color = 'cyan', children}) {
  return h(Box, {flexDirection: 'column', borderStyle: 'round', borderColor: color, paddingX: 1, marginBottom: 1},
    h(Text, {bold: true, color}, title), children);
}

function Progress({active}) {
  const [frame, setFrame] = useState(0);
  const frames = ['·', '▂', '▄', '▆', '█', '▆', '▄', '▂'];
  useEffect(() => {
    const timer = setInterval(() => setFrame(value => (value + 1) % frames.length), 100);
    return () => clearInterval(timer);
  }, []);
  return h(Text, {color: 'cyan'},
    `${frames[frame]} ${active >= 0 ? `[${active + 1}/${checks.length}] ${checks[active].label} 검사 중` : '검사 준비 중'} · 잠시 기다려주세요`);
}

function statusText(status) {
  if (status === 'passed') return h(Text, {color: 'green'}, '✓ passed');
  if (status === 'failed') return h(Text, {color: 'red'}, '✗ failed');
  if (status === 'running') return h(Text, {color: 'yellow'}, '● running');
  return h(Text, {dimColor: true}, '○ pending');
}

function todoLines(todos = [], prefix = 'todo') {
  if (!todos.length) return [h(Text, {key: `${prefix}-empty`, dimColor: true}, '  (empty)')];
  return todos.map(todo => h(Text, {key: `${prefix}-${todo.number}`},
    h(Text, {color: todo.status === '완료' ? 'green' : 'yellow'}, `${todo.status === '완료' ? '✓' : '○'} `),
    h(Text, {dimColor: true}, `${todo.number}. `), todo.task));
}

function Table({headers, data, widths}) {
  return h(Box, {flexDirection: 'column', borderStyle: 'single', borderColor: 'gray'},
    [headers, ...data].map((cells, row) => h(Box, {key: row, borderStyle: 'single', borderTop: false, borderBottom: row === 0, borderLeft: false, borderRight: false},
      cells.map((cell, column) => h(Box, {
        key: column, width: widths[column], flexGrow: column === cells.length - 1 ? 1 : 0,
        flexShrink: column === cells.length - 1 ? 1 : 0, minWidth: 0, paddingX: 1, borderStyle: 'single', borderTop: false,
        borderBottom: false, borderLeft: column > 0, borderRight: false,
      }, h(Text, {bold: row === 0, color: row === 0 ? 'white' : 'green'}, String(cell)))))));
}

function FinalReport({report, columns, logs, finalStatus}) {
  const toolTable = tools => h(Table, {
    headers: ['(index)', '도구', '이름', '설명'],
    widths: [10, Math.min(32, Math.floor(columns * 0.32)), 20, undefined],
    data: tools.map((tool, index) => [index, tool.name, tool.title, tool.description]),
  });
  const todos = items => h(Table, {
    headers: ['(index)', '#', '상태', '할 일'], widths: [10, 5, 14, undefined],
    data: items.map((todo, index) => [index, todo.number, `${todo.status === '완료' ? '✓' : '○'} ${todo.status}`, todo.task]),
  });
  return h(Box, {flexDirection: 'column', width: columns},
    h(Panel, {title: 'WebMCP Browser Test Client'}, h(Text, null, finalStatus)),
    h(Text, null, `Target: ${report.target}`),
    h(Text, {dimColor: true}, 'Local guide · modelContext test shim · todo tools are local test fixtures'),
    h(Panel, {title: '1. Browser / WebMCP'},
      h(Text, null, `Chrome        ${report.browser}`),
      ...['modelContext', 'getTools', 'executeTool'].map(name => h(Text, {key: name}, `${name.padEnd(14)}✓ (test shim)`))),
    h(Panel, {title: '2. Registered WebMCP Tools'},
      h(Text, null, 'Page tools'), toolTable(report.tools),
      h(Text, null, 'Local todo fixture tools'), toolTable(report.todoTools)),
    h(Panel, {title: '3. Initial Todo List'}, todos(report.initialTodos)),
    h(Panel, {title: '4. WebMCP Tool Calls · Local Fixture'},
      report.todoCalls.map((call, index) => h(Text, {key: index, color: 'green'},
        `✓ ${call.name}: ${call.result.task} (${call.result.createdAt})`))),
    h(Panel, {title: '5. Final Todo List'}, todos(report.finalTodos)),
    h(Panel, {title: 'TEST LOG', color: process.exitCode === 0 ? 'green' : 'red'},
      logs.map((line, index) => h(Text, {key: index}, line))),
    h(Text, {bold: true, color: process.exitCode === 0 ? 'green' : 'red'}, finalStatus));
}

function App() {
  const [statuses, setStatuses] = useState(checks.map(() => 'pending'));
  const [active, setActive] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [finished, setFinished] = useState(false);
  const {exit} = useApp();
  const {columns = 100, rows = 24} = useWindowSize();

  useEffect(() => {
    const appendLine = line => {
      if (line.startsWith('WEBMCP_REPORT_JSON=')) {
        try { setReport(JSON.parse(line.slice('WEBMCP_REPORT_JSON='.length))); }
        catch (error) { setLogs(previous => [...previous.slice(-7), `Invalid browser report: ${error.message}`]); }
        return;
      }
      setLogs(previous => [...previous.slice(-8), line]);
    };
    (async () => {
      let exitCode = 0;
      for (let index = 0; index < checks.length; index++) {
        setActive(index);
        setStatuses(previous => previous.map((status, step) => step === index ? 'running' : status));
        const code = await runCheck(checks[index], appendLine);
        setStatuses(previous => previous.map((status, step) => step === index ? (code === 0 ? 'passed' : 'failed') : status));
        if (code !== 0) { exitCode = code; break; }
      }
      process.exitCode = exitCode;
      setActive(-1);
      setFinished(true);
      setTimeout(exit, 120);
    })();
  }, []);

  const title = 'WebMCP Field Guide · Test Run';
  const calls = report?.todoCalls ?? [];
  const finalStatus = finished ? (process.exitCode === 0 ? 'ALL CHECKS PASSED' : 'CHECKS FAILED') : 'RUNNING';
  const compact = rows < 36;
  const pageToolNames = (report?.tools ?? []).map(tool => tool.name).join(' · ');
  const recentLogs = logs.slice(-(compact ? 2 : 8));
  if (finished && report) return h(Static, {items: [report]},
    item => h(FinalReport, {key: 'final-report', report: item, columns, logs, finalStatus}));
  if (compact) return h(Box, {flexDirection: 'column', paddingX: 1, width: columns},
    h(Text, {bold: true, color: 'cyan'}, `◆ ${title}  ·  ${finalStatus}`),
    h(Text, null, `Target  ${report?.target ?? 'starting local guide…'}`),
    h(Text, null, `Browser ${report?.browser ?? 'detecting…'}  ·  modelContext test shim  ·  ${report?.tools.length ?? '…'} page tools`),
    h(Text, {dimColor: true}, `Page tools: ${pageToolNames || 'loading…'}`),
    h(Text, {dimColor: true, wrap: 'truncate-end'}, `Fixture tools: ${(report?.todoTools ?? []).map(tool => tool.name).join(' · ') || 'loading…'}`),
    h(Text, {bold: true, color: 'cyan'}, 'WEBMCP TOOL CALLS · LOCAL TEST FIXTURE'),
    ...(calls.length ? calls.map((call, index) => h(Text, {key: `${call.name}-${index}`, wrap: 'truncate-end'},
      h(Text, {color: 'green'}, '✓ '), h(Text, {color: 'cyan'}, `${call.name}: `),
      `${call.result.task}  (${call.result.createdAt})`)) : [h(Text, {dimColor: true}, 'Waiting for todo tool execution…')]),
    ...(report ? [
      h(Text, {key: 'initial-title', bold: true, color: 'white'}, `INITIAL TODO LIST · ${report.initialTodos.length}`),
      ...todoLines(report.initialTodos, 'initial'),
      h(Text, {key: 'final-title', bold: true, color: 'white'}, `FINAL TODO LIST · ${report.finalTodos.length}`),
      ...todoLines(report.finalTodos, 'final'),
    ] : [h(Text, {key: 'todo-loading', dimColor: true}, 'Waiting for todo tool execution…')]),
    h(Box, {flexDirection: 'column', borderStyle: 'round', borderColor: finished ? (process.exitCode === 0 ? 'green' : 'red') : 'blue', paddingX: 1},
      h(Text, {bold: true, color: 'cyan'}, `LIVE LOG${active >= 0 ? ` · ${checks[active].label}` : ''}`),
      !finished && h(Progress, {active}),
      ...(recentLogs.length ? recentLogs.map((line, index) => h(Text, {key: `${index}-${line}`, wrap: 'truncate-end'}, line)) : [h(Text, {dimColor: true}, 'Waiting for test output…')])) ,
    h(Text, {dimColor: true}, 'Ctrl+C to cancel'));

  return h(Box, {flexDirection: 'column', padding: 1, width: columns},
    h(Box, {borderStyle: 'double', borderColor: 'cyan', paddingX: 1, marginBottom: 1, justifyContent: 'space-between'},
      h(Text, {bold: true, color: 'cyan'}, `◆ ${title}`),
      h(Text, {bold: true, color: finished ? (process.exitCode === 0 ? 'green' : 'red') : 'yellow'}, finalStatus)),
    h(Panel, {title: 'BROWSER / WEBMCP'},
      h(Text, null, `Target  ${report?.target ?? 'starting local guide…'}`),
      h(Text, null, `Browser ${report?.browser ?? 'detecting…'}   ·   modelContext test shim`),
      h(Text, null, `Page tools ${report?.tools.length ?? '…'}   ·   Browser checks use the local guide`),
      h(Box, {flexDirection: 'column', marginTop: 1}, checks.map((check, index) => h(Box, {key: check.label, justifyContent: 'space-between'},
        h(Text, {dimColor: true}, check.label), statusText(statuses[index]))))),
    h(Panel, {title: `REGISTERED PAGE TOOLS${report ? ` · ${report.tools.length}` : ''}`},
      ...(report?.tools ?? []).map(tool => h(Box, {key: tool.name, flexDirection: 'column', marginBottom: 1},
        h(Text, null, h(Text, {color: 'cyan', bold: true}, tool.name), h(Text, {color: 'green'}, `  ${tool.title}`)),
        h(Text, {dimColor: true}, `  ${tool.description}`)))),
    h(Panel, {title: 'WEBMCP TOOL CALLS · LOCAL TEST FIXTURE'},
      h(Text, {dimColor: true}, `Registered fixture tools: ${(report?.todoTools ?? []).map(tool => tool.name).join(' · ') || 'loading…'}`),
      calls.length ? calls.map((call, index) => h(Text, {key: `${call.name}-${index}`},
        h(Text, {color: 'green'}, '✓ '), h(Text, {color: 'cyan'}, `${call.name}: `),
        `${call.result.task}  (${call.result.createdAt})`)) : h(Text, {dimColor: true}, 'Waiting for todo tool execution…'),
      report && h(Box, {flexDirection: 'row', marginTop: 1},
        h(Box, {flexDirection: 'column', width: Math.floor(columns / 2) - 4, marginRight: 2},
          h(Text, {bold: true, color: 'white'}, 'INITIAL TODO LIST'), ...todoLines(report.initialTodos)),
        h(Box, {flexDirection: 'column', width: Math.floor(columns / 2) - 4},
          h(Text, {bold: true, color: 'white'}, 'FINAL TODO LIST'), ...todoLines(report.finalTodos)))),
    h(Panel, {title: `LIVE LOG${active >= 0 ? ` · ${checks[active].label}` : ''}`, color: finished ? (process.exitCode === 0 ? 'green' : 'red') : 'blue'},
      !finished && h(Progress, {active}),
      h(Box, {flexDirection: 'column', height: 8, overflow: 'hidden'},
        ...(recentLogs.length ? recentLogs.map((line, index) => h(Text, {
          key: `${index}-${line}`,
          color: /(^|\s)(PASS|OK):/.test(line) ? 'green' : /error|failed|traceback/i.test(line) ? 'red' : 'white',
          wrap: 'truncate-end',
        }, line)) : [h(Text, {key: 'wait', dimColor: true}, 'Waiting for test output…')]))),
    h(Text, {dimColor: true}, 'Local test shim · Ctrl+C to cancel'));
}

const {waitUntilExit} = render(h(App), {exitOnCtrlC: true});
await waitUntilExit();
