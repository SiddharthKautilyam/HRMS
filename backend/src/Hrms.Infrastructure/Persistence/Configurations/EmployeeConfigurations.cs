using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Configurations;

public sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("Employees");

        builder.Property(e => e.EmployeeCode).HasMaxLength(20).IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(60).IsRequired();
        builder.Property(e => e.MiddleName).HasMaxLength(60);
        builder.Property(e => e.LastName).HasMaxLength(60).IsRequired();
        builder.Property(e => e.Email).HasMaxLength(160).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(30);
        builder.Property(e => e.BloodGroup).HasMaxLength(5);
        builder.Property(e => e.Nationality).HasMaxLength(60);
        builder.Property(e => e.Address).HasMaxLength(250);
        builder.Property(e => e.City).HasMaxLength(60);
        builder.Property(e => e.State).HasMaxLength(60);
        builder.Property(e => e.Country).HasMaxLength(60);
        builder.Property(e => e.JobTitle).HasMaxLength(80).IsRequired();
        builder.Property(e => e.Grade).HasMaxLength(10).IsRequired();
        builder.Property(e => e.Currency).HasMaxLength(3).IsRequired();
        builder.Property(e => e.BankName).HasMaxLength(120);
        builder.Property(e => e.AccountName).HasMaxLength(120);
        builder.Property(e => e.AccountNumber).HasMaxLength(40);
        builder.Property(e => e.Iban).HasMaxLength(40);
        builder.Property(e => e.IfscCode).HasMaxLength(20);
        builder.Property(e => e.SwiftCode).HasMaxLength(20);
        builder.Property(e => e.WpsId).HasMaxLength(40);
        builder.Property(e => e.PassportNumber).HasMaxLength(40);
        builder.Property(e => e.VisaNumber).HasMaxLength(40);
        builder.Property(e => e.EmiratesId).HasMaxLength(40);

        builder.Property(e => e.Gender).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.MaritalStatus).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.EmploymentType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.PaymentMode).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Ignore(e => e.FullName);

        builder.HasIndex(e => e.EmployeeCode).IsUnique();
        builder.HasIndex(e => e.Email).IsUnique();

        builder.HasOne(e => e.Department)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Designation)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DesignationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Branch)
            .WithMany(b => b.Employees)
            .HasForeignKey(e => e.BranchId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Shift)
            .WithMany(s => s.Employees)
            .HasForeignKey(e => e.ShiftId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.ReportingManager)
            .WithMany()
            .HasForeignKey(e => e.ReportingManagerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class EmployeeDocumentConfiguration : IEntityTypeConfiguration<EmployeeDocument>
{
    public void Configure(EntityTypeBuilder<EmployeeDocument> builder)
    {
        builder.ToTable("EmployeeDocuments");
        builder.Property(d => d.Name).HasMaxLength(120).IsRequired();
        builder.Property(d => d.DocumentNumber).HasMaxLength(60);
        builder.Property(d => d.IssuedBy).HasMaxLength(120);
        builder.Property(d => d.Notes).HasMaxLength(500);
        builder.Property(d => d.FileSize).HasMaxLength(20);
        builder.Property(d => d.FileUrl).HasMaxLength(500);
        builder.Property(d => d.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(d => d.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(d => d.Employee)
            .WithMany(e => e.Documents)
            .HasForeignKey(d => d.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.IsCompanyDocument);
    }
}
