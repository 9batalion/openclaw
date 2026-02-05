import type { AnalysisResult, Report, ReportOptions } from "../types.ts";

/**
 * Generates comprehensive reports from analysis results
 */
export async function generateReport(
  options: ReportOptions,
): Promise<Report> {
  const { format, analyses } = options;

  let content: string;
  if (format === "markdown") {
    content = generateMarkdownReport(options);
  } else if (format === "html") {
    content = generateHtmlReport(options);
  } else {
    throw new Error(`Unsupported report format: ${format}`);
  }

  return {
    content,
    format,
    metadata: {
      generatedAt: new Date().toISOString(),
      analysesCount: analyses.length,
    },
  };
}

/**
 * Generates a Markdown report
 */
function generateMarkdownReport(options: ReportOptions): string {
  const { analyses, includeCharts, includeDashboard, title } = options;

  const sections: string[] = [];

  // Title
  sections.push(`# ${title || "Analysis Report"}\n`);
  sections.push(`Generated: ${new Date().toLocaleString()}\n`);
  sections.push(`Total Analyses: ${analyses.length}\n`);

  // Summary
  sections.push("## Summary\n");
  const successCount = analyses.filter((a) => a.success).length;
  const failureCount = analyses.length - successCount;
  sections.push(`- Successful: ${successCount}`);
  sections.push(`- Failed: ${failureCount}\n`);

  // Individual analyses
  for (const [index, analysis] of analyses.entries()) {
    sections.push(`## Analysis ${index + 1}: ${analysis.type}\n`);

    if (!analysis.success) {
      sections.push(`**Error:** ${analysis.error}\n`);
      continue;
    }

    sections.push(formatAnalysisResults(analysis));

    if (includeCharts && shouldIncludeChart(analysis)) {
      sections.push(generateChartMarkdown(analysis));
    }
  }

  // Dashboard
  if (includeDashboard) {
    sections.push(generateDashboardMarkdown(analyses));
  }

  return sections.join("\n");
}

/**
 * Generates an HTML report
 */
function generateHtmlReport(options: ReportOptions): string {
  const { analyses, includeCharts, includeDashboard, title } = options;

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
      h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
      h2 { color: #555; margin-top: 30px; }
      .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
      .analysis { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
      .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 5px; }
      .chart { margin: 20px 0; padding: 15px; background: #fff; border: 1px solid #ddd; }
      table { border-collapse: collapse; width: 100%; margin: 10px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #007bff; color: white; }
    </style>
  `;

  const sections: string[] = [];
  sections.push("<!DOCTYPE html>");
  sections.push("<html>");
  sections.push("<head>");
  sections.push(`<title>${title || "Analysis Report"}</title>`);
  sections.push(styles);
  sections.push("</head>");
  sections.push("<body>");

  // Title
  sections.push(`<h1>${title || "Analysis Report"}</h1>`);
  sections.push(
    `<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>`,
  );

  // Summary
  sections.push('<div class="summary">');
  sections.push("<h2>Summary</h2>");
  const successCount = analyses.filter((a) => a.success).length;
  const failureCount = analyses.length - successCount;
  sections.push(`<p><strong>Total Analyses:</strong> ${analyses.length}</p>`);
  sections.push(`<p><strong>Successful:</strong> ${successCount}</p>`);
  sections.push(`<p><strong>Failed:</strong> ${failureCount}</p>`);
  sections.push("</div>");

  // Individual analyses
  for (const [index, analysis] of analyses.entries()) {
    sections.push('<div class="analysis">');
    sections.push(`<h2>Analysis ${index + 1}: ${analysis.type}</h2>`);

    if (!analysis.success) {
      sections.push(`<div class="error"><strong>Error:</strong> ${analysis.error}</div>`);
    } else {
      sections.push(formatAnalysisResultsHtml(analysis));

      if (includeCharts && shouldIncludeChart(analysis)) {
        sections.push(generateChartHtml(analysis));
      }
    }

    sections.push("</div>");
  }

  // Dashboard
  if (includeDashboard) {
    sections.push(generateDashboardHtml(analyses));
  }

  sections.push("</body>");
  sections.push("</html>");

  return sections.join("\n");
}

/**
 * Formats analysis results for Markdown
 */
function formatAnalysisResults(analysis: AnalysisResult): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(analysis.results)) {
    lines.push(`### ${key}\n`);
    lines.push(`\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`);
  }

  return lines.join("\n");
}

/**
 * Formats analysis results for HTML
 */
function formatAnalysisResultsHtml(analysis: AnalysisResult): string {
  const sections: string[] = [];

  for (const [key, value] of Object.entries(analysis.results)) {
    sections.push(`<h3>${key}</h3>`);
    sections.push(`<pre>${JSON.stringify(value, null, 2)}</pre>`);
  }

  return sections.join("\n");
}

/**
 * Determines if a chart should be included for an analysis
 */
function shouldIncludeChart(analysis: AnalysisResult): boolean {
  return (
    analysis.type === "numeric" ||
    (analysis.type === "text" &&
      "sentiment" in analysis.results)
  );
}

/**
 * Generates chart representation in Markdown
 */
function generateChartMarkdown(analysis: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("### Chart\n");

  if (analysis.type === "numeric") {
    lines.push("```");
    lines.push("Numeric Data Visualization (conceptual)");
    lines.push("│");
    lines.push("│  ╭─────╮");
    lines.push("│  │     │  ╭──╮");
    lines.push("│╭─┤     │  │  │");
    lines.push("││ │     ├──┤  │");
    lines.push("└┴─┴─────┴──┴──┴──");
    lines.push("```\n");
  } else if (analysis.type === "text" && "sentiment" in analysis.results) {
    const sentiment = analysis.results.sentiment as {
      label: string;
      score: number;
    };
    lines.push(`**Sentiment:** ${sentiment.label} (${sentiment.score.toFixed(2)})\n`);
  }

  return lines.join("\n");
}

/**
 * Generates chart representation in HTML
 */
function generateChartHtml(analysis: AnalysisResult): string {
  return '<div class="chart"><p><em>Chart visualization placeholder</em></p></div>';
}

/**
 * Generates dashboard in Markdown
 */
function generateDashboardMarkdown(analyses: AnalysisResult[]): string {
  const lines: string[] = [];
  lines.push("## Dashboard\n");

  // Create summary table
  lines.push("| Type | Status | Duration (ms) |");
  lines.push("|------|--------|---------------|");

  for (const analysis of analyses) {
    const status = analysis.success ? "✓ Success" : "✗ Failed";
    lines.push(
      `| ${analysis.type} | ${status} | ${analysis.metadata.duration} |`,
    );
  }

  return lines.join("\n");
}

/**
 * Generates dashboard in HTML
 */
function generateDashboardHtml(analyses: AnalysisResult[]): string {
  const sections: string[] = [];
  sections.push("<h2>Dashboard</h2>");
  sections.push("<table>");
  sections.push("<thead><tr><th>Type</th><th>Status</th><th>Duration (ms)</th></tr></thead>");
  sections.push("<tbody>");

  for (const analysis of analyses) {
    const status = analysis.success ? "✓ Success" : "✗ Failed";
    sections.push(
      `<tr><td>${analysis.type}</td><td>${status}</td><td>${analysis.metadata.duration}</td></tr>`,
    );
  }

  sections.push("</tbody>");
  sections.push("</table>");

  return sections.join("\n");
}
