"use strict";

parserFactory.register("readnovel.eu", () => new WuxiaworldeuParser());
parserFactory.register("wuxiaworld.eu", () => new WuxiaworldeuParser());
parserFactory.register("wuxia.click", () => new WuxiaworldeuParser());

class WuxiaworldeuParser extends Parser {
    constructor() {
        super();
    }

    // ─── TOC ──────────────────────────────────────────────────────
    async getChapterUrls(dom) {
        let urls = [];

        // Resolve chapter hrefs against the page they came from, so the
        // parser works on readnovel.eu, wuxiaworld.eu, and wuxia.click alike.
        const addChapters = (doc, baseUrl) => {
            let added = 0;
            doc.querySelectorAll("section#chapters ol li a[href*='/chapter/']")
               .forEach(a => {
                   let href = a.getAttribute("href") || "";
                   let abs;
                   try { abs = new URL(href, baseUrl).href; }
                   catch (_) { return; }

                   // Clone + strip <time> so "4 years ago" doesn't fuse onto the title
                   let clone = a.cloneNode(true);
                   clone.querySelectorAll("time").forEach(t => t.remove());
                   let title = clone.textContent.replace(/\s+/g, " ").trim();

                   urls.push({ sourceUrl: abs, title });
                   added++;
               });
            return added;
        };

        let tocUrl = dom.baseURI.split("?")[0].split("#")[0];
        addChapters(dom, tocUrl);

        for (let page = 2; page <= 50; page++) {
            let pageUrl = `${tocUrl}?page=${page}`;
            let pageDom;
            try {
                let response = await HttpClient.fetchHtml(pageUrl);
                pageDom = response.responseXML;
            } catch (_) {
                break;
            }
            if (addChapters(pageDom, pageUrl) === 0) break;
        }

        return urls;
    }

    // ─── Chapter page ─────────────────────────────────────────────
    findContent(dom) {
        return dom.querySelector("div#chapter-content");
    }

    findChapterTitle(dom) {
        return dom.querySelector("h1.reader-title");
    }

    removeUnwantedElementsFromContentElement(element) {
        util.removeChildElementsMatchingSelector(
            element, "aside[aria-label='Advertisement']"
        );
        super.removeUnwantedElementsFromContentElement(element);
    }

    // ─── Metadata ─────────────────────────────────────────────────
    extractTitleImpl(dom) {
        let el = dom.querySelector("h1");
        return el ? el.textContent.trim() : super.extractTitleImpl(dom);
    }

    findCoverImageUrl(dom) {
        let img = dom.querySelector("img[alt$=' cover' i]")
               || dom.querySelector("div.w-28 img");
        return img ? img.src : super.findCoverImageUrl(dom);
    }

    extractAuthor(dom) {
        let p = [...dom.querySelectorAll("p")].find(
            el => /^by\s/i.test(el.textContent.trim()) && el.querySelector("span")
        );
        if (!p) return super.extractAuthor(dom);
        let name = p.querySelector("span.text-foreground") || p.querySelector("span");
        return name ? name.textContent.trim() : super.extractAuthor(dom);
    }

    // ─── Information page ─────────────────────────────────────────
    getInformationEpubItemChildNodes(dom) {
        return [...dom.querySelectorAll("section[aria-labelledby='synopsis-heading']")];
    }

    cleanInformationNode(node) {
        util.removeChildElementsMatchingSelector(node, "button");
        return node;
    }
}
