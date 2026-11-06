namespace Hrms.Api.Security;

/// <summary>
/// Marks an action or controller as exempt from the dynamic module permission filter.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class OptOutPermissionAttribute : Attribute
{
}
