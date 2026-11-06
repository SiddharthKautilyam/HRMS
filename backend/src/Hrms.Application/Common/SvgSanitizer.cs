using System.Xml;
using System.Xml.Linq;

namespace Hrms.Application.Common;

/// <summary>
/// Sanitizes SVG documents to prevent XSS, XXE, SSRF, and DOM clobbering attacks.
/// Strips executable elements (script, foreignObject, iframe, embed, etc.)
/// and malicious event attributes (onload, onerror, onclick, etc.).
/// </summary>
public static class SvgSanitizer
{
    private static readonly HashSet<string> DisallowedElements = new(StringComparer.OrdinalIgnoreCase)
    {
        "script",
        "foreignobject",
        "applet",
        "object",
        "embed",
        "iframe",
        "audio",
        "video",
        "form",
        "input",
        "button",
        "textarea",
        "link",
        "meta"
    };

    public static string Sanitize(string svgText)
    {
        if (string.IsNullOrWhiteSpace(svgText)) return string.Empty;
        var bytes = System.Text.Encoding.UTF8.GetBytes(svgText);
        return TrySanitize(bytes, out var clean) ? System.Text.Encoding.UTF8.GetString(clean) : string.Empty;
    }

    public static bool TrySanitize(byte[] svgBytes, out byte[] sanitizedBytes)
    {
        sanitizedBytes = Array.Empty<byte>();
        if (svgBytes == null || svgBytes.Length == 0)
        {
            return false;
        }

        try
        {
            var settings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null,
                IgnoreComments = true,
                IgnoreProcessingInstructions = true,
                MaxCharactersInDocument = 10_000_000
            };

            using var ms = new MemoryStream(svgBytes);
            using var reader = XmlReader.Create(ms, settings);
            var doc = XDocument.Load(reader);

            if (doc.Root == null || !doc.Root.Name.LocalName.Equals("svg", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            // 1. Remove disallowed elements recursively
            var elementsToRemove = doc.Descendants()
                .Where(e => DisallowedElements.Contains(e.Name.LocalName))
                .ToList();

            foreach (var el in elementsToRemove)
            {
                el.Remove();
            }

            // 2. Sanitize <style> tags (remove if containing @import, url(), expression(), or -moz-binding)
            var styleElements = doc.Descendants()
                .Where(e => e.Name.LocalName.Equals("style", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var styleEl in styleElements)
            {
                var val = styleEl.Value ?? string.Empty;
                if (val.Contains("@import", StringComparison.OrdinalIgnoreCase) ||
                    val.Contains("url(", StringComparison.OrdinalIgnoreCase) ||
                    val.Contains("expression(", StringComparison.OrdinalIgnoreCase) ||
                    val.Contains("-moz-binding", StringComparison.OrdinalIgnoreCase) ||
                    val.Contains("javascript:", StringComparison.OrdinalIgnoreCase))
                {
                    styleEl.Remove();
                }
            }

            // 3. Sanitize <use> tags: href / xlink:href MUST be a local fragment identifier (starting with '#')
            var useElements = doc.Descendants()
                .Where(e => e.Name.LocalName.Equals("use", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var useEl in useElements)
            {
                var hrefAttr = useEl.Attributes().FirstOrDefault(a =>
                    a.Name.LocalName.Equals("href", StringComparison.OrdinalIgnoreCase));

                if (hrefAttr != null)
                {
                    var val = hrefAttr.Value.Trim();
                    if (!val.StartsWith("#", StringComparison.Ordinal))
                    {
                        useEl.Remove();
                        continue;
                    }
                }
            }

            // 4. Sanitize <image> tags: remove if href is external (http/https/ftp//) or contains data/javascript
            var imageElements = doc.Descendants()
                .Where(e => e.Name.LocalName.Equals("image", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var imgEl in imageElements)
            {
                var hrefAttr = imgEl.Attributes().FirstOrDefault(a =>
                    a.Name.LocalName.Equals("href", StringComparison.OrdinalIgnoreCase));

                if (hrefAttr != null)
                {
                    var val = hrefAttr.Value.Trim();
                    if (val.StartsWith("http:", StringComparison.OrdinalIgnoreCase) ||
                        val.StartsWith("https:", StringComparison.OrdinalIgnoreCase) ||
                        val.StartsWith("//", StringComparison.OrdinalIgnoreCase) ||
                        val.StartsWith("data:", StringComparison.OrdinalIgnoreCase) ||
                        val.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase))
                    {
                        imgEl.Remove();
                        continue;
                    }
                }
            }

            // 5. Remove dangerous attributes across all remaining elements
            foreach (var el in doc.Descendants().Concat(new[] { doc.Root }))
            {
                var attrsToRemove = el.Attributes()
                    .Where(a =>
                        a.Name.LocalName.StartsWith("on", StringComparison.OrdinalIgnoreCase) ||
                        a.Value.Contains("javascript:", StringComparison.OrdinalIgnoreCase) ||
                        a.Value.Contains("vbscript:", StringComparison.OrdinalIgnoreCase) ||
                        a.Value.Contains("data:", StringComparison.OrdinalIgnoreCase) ||
                        a.Value.Contains("expression(", StringComparison.OrdinalIgnoreCase) ||
                        (a.Name.LocalName.Equals("style", StringComparison.OrdinalIgnoreCase) &&
                         (a.Value.Contains("url(", StringComparison.OrdinalIgnoreCase) ||
                          a.Value.Contains("@import", StringComparison.OrdinalIgnoreCase))))
                    .ToList();

                foreach (var attr in attrsToRemove)
                {
                    attr.Remove();
                }
            }

            using var outMs = new MemoryStream();
            using var writer = XmlWriter.Create(outMs, new XmlWriterSettings
            {
                OmitXmlDeclaration = false,
                Indent = false
            });

            doc.Save(writer);
            writer.Flush();
            sanitizedBytes = outMs.ToArray();
            return true;
        }
        catch
        {
            return false;
        }
    }
}
