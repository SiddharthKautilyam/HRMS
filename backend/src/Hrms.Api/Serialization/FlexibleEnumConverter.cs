using System.Text.Json;
using System.Text.Json.Serialization;

namespace Hrms.Api.Serialization;

/// <summary>
/// A resilient string/number JSON converter for Enums that tolerates spaces, hyphens, and case differences
/// (e.g., converts "On Leave" or "on-leave" to EmploymentStatus.OnLeave).
/// </summary>
public sealed class FlexibleEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

    public override JsonConverter? CreateConverter(Type typeToConvert, JsonSerializerOptions options)
    {
        var converterType = typeof(FlexibleEnumConverterInner<>).MakeGenericType(typeToConvert);
        return (JsonConverter?)Activator.CreateInstance(converterType);
    }

    private sealed class FlexibleEnumConverterInner<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                var str = reader.GetString();
                if (string.IsNullOrWhiteSpace(str))
                {
                    return default;
                }

                var normalized = str.Replace(" ", "").Replace("-", "").Replace("_", "");
                if (Enum.TryParse<T>(normalized, ignoreCase: true, out var result))
                {
                    return result;
                }

                if (Enum.TryParse<T>(str, ignoreCase: true, out var fallback))
                {
                    return fallback;
                }
            }
            else if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var intVal))
            {
                return (T)(object)intVal;
            }

            return default;
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value.ToString());
        }
    }
}
