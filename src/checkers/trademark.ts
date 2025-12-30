import type { Checker, CheckResult } from "../types";
import { fetchWithTimeout, createErrorResult } from "./base";

// USPTO TESS doesn't have a public API, so we provide a URL for manual checking
export const usptoChecker: Checker = {
  name: "uspto",
  category: "trademark",
  async check(name: string): Promise<CheckResult> {
    // TESS uses a session-based system and doesn't support direct linking well
    // We provide the search URL but can't automate the check
    const searchUrl = `https://tmsearch.uspto.gov/bin/showfield?f=toc&state=4809%3Anknlo5.1.1&p_search=searchss&p_L=50&BackReference=&p_plural=yes&p_s_PARA1=&p_taession=&p_PARA1=${encodeURIComponent(name)}&p_PARA2=live&p_op_ALL=AND&a_default=search&a_search=Submit+Query`;

    return {
      name,
      platform: "uspto",
      available: true, // We can't determine this automatically
      url: searchUrl,
      error: "Manual check required - click URL to search USPTO TESS",
    };
  },
};

// Google search for software/open source mentions
export const googleSoftwareChecker: Checker = {
  name: "google-software",
  category: "trademark",
  async check(name: string): Promise<CheckResult> {
    const query = `"${name}" software`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    return {
      name,
      platform: "google-software",
      available: true, // Manual check required
      url: searchUrl,
      error: "Manual check required - click URL to search Google",
    };
  },
};

export const googleOpenSourceChecker: Checker = {
  name: "google-opensource",
  category: "trademark",
  async check(name: string): Promise<CheckResult> {
    const query = `"${name}" open source`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    return {
      name,
      platform: "google-opensource",
      available: true, // Manual check required
      url: searchUrl,
      error: "Manual check required - click URL to search Google",
    };
  },
};

// FOSSmarks.org guidance - provide link to the resource
export const fossmarksChecker: Checker = {
  name: "fossmarks",
  category: "trademark",
  async check(name: string): Promise<CheckResult> {
    // FOSSmarks is a guide, not a database, so we link to the main page
    return {
      name,
      platform: "fossmarks",
      available: true,
      url: "https://fossmarks.org/",
      error: "Reference resource - review FOSS trademark guidance",
    };
  },
};
