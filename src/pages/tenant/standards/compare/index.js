import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Box,
  Divider,
  Chip,
  Skeleton,
  Alert,
} from "@mui/material";
import { Layout as DashboardLayout } from "/src/layouts/index.js";
import { PlayArrow, CheckCircle, Cancel, Info, Public, Microsoft } from "@mui/icons-material";
import { ArrowLeftIcon } from "@mui/x-date-pickers";
import CippFormComponent from "/src/components/CippComponents/CippFormComponent";
import standards from "/src/data/standards.json";
import { CippApiResults } from "../../../../components/CippComponents/CippApiResults";
import { CippApiDialog } from "../../../../components/CippComponents/CippApiDialog";
import { SvgIcon } from "@mui/material";
import { useForm } from "react-hook-form";
import { useSettings } from "../../../../hooks/use-settings";
import { ApiGetCall, ApiPostCall } from "../../../../api/ApiCall";
import { useRouter } from "next/router";
import { useDialog } from "../../../../hooks/use-dialog";
import { Grid } from "@mui/system";

const Page = () => {
  const router = useRouter();
  const { templateId } = router.query;
  const [comparisonData, setComparisonData] = useState(null);
  const settings = useSettings();
  const currentTenant = settings?.currentTenant;
  const formControl = useForm({
    mode: "onBlur",
    defaultValues: {
      comparisonMode: "standard",
    },
  });
  const runReportDialog = useDialog();

  const templateDetails = ApiGetCall({
    url: `/api/listStandardTemplates`,
    queryKey: `listStandardTemplates-reports`,
  });

  // Run the report once
  const runReport = ApiPostCall({ relatedQueryKeys: ["ListStandardsCompare"] });

  // Dialog configuration for Run Report Once
  const runReportApi = {
    type: "GET",
    url: "/api/ExecStandardsRun",
    data: {
      TemplateId: templateId,
    },
    confirmText: "Are you sure you want to run this standard report?",
  };

  // Get comparison data
  const comparisonApi = ApiGetCall({
    url: "/api/ListStandardsCompare",
    data: {
      TemplateId: templateId,
      CompareTenantId: formControl.watch("compareTenantId"),
      CompareToStandard: true, // Always compare to standard, even in tenant comparison mode
    },
    queryKey: `ListStandardsCompare-${templateId}-${
      formControl.watch("compareTenantId") || "standard"
    }-${currentTenant}`,
    enabled: !!templateId, // Only run the query if templateId is available
  });

  useEffect(() => {
    if (templateId && templateDetails.isSuccess && templateDetails.data) {
      const selectedTemplate = templateDetails.data.find(
        (template) => template.GUID === templateId
      );

      if (selectedTemplate && comparisonApi.isSuccess && comparisonApi.data) {
        const tenantData = comparisonApi.data;
        
        // Find the current tenant's data by matching tenantFilter with currentTenant
        const currentTenantObj = tenantData.find(t => t.tenantFilter === currentTenant);
        const currentTenantData = currentTenantObj ? currentTenantObj.standardsResults || [] : [];
        
        const allStandards = [];
        if (selectedTemplate.standards) {
          Object.entries(selectedTemplate.standards).forEach(([standardKey, standardConfig]) => {
            const standardId = `standards.${standardKey}`;
            const standardInfo = standards.find((s) => s.name === standardId);
            const standardSettings = standardConfig.standards?.[standardKey] || {};

            // Find the tenant's value for this standard
            const currentTenantStandard = currentTenantData.find(
              (s) => s.standardId === standardId
            );

            // Determine compliance status
            let isCompliant = false;
            
            // Check if the standard is directly in the tenant object (like "standards.AuditLog": true)
            const standardIdWithoutPrefix = standardId.replace('standards.', '');
            const directStandardValue = currentTenantObj?.[standardId];
            
            // Special case for boolean standards that are true in the tenant
            if (directStandardValue === true) {
              // If the standard is directly in the tenant and is true, it's compliant
              isCompliant = true;
            } else if (directStandardValue !== undefined) {
              // For non-boolean values, use strict equality
              isCompliant = JSON.stringify(directStandardValue) === JSON.stringify(standardSettings);
            } else if (currentTenantStandard) {
              // Fall back to the previous logic if the standard is not directly in the tenant object
              if (typeof standardSettings === 'boolean' && standardSettings === true) {
                isCompliant = currentTenantStandard.value === true;
              } else {
                isCompliant = JSON.stringify(currentTenantStandard.value) === JSON.stringify(standardSettings);
              }
            }

            // Use the direct standard value from the tenant object if it exists
            
            allStandards.push({
              standardId,
              standardName: standardInfo?.label || standardKey,
              currentTenantValue: directStandardValue !== undefined ? directStandardValue : currentTenantStandard?.value,
              standardValue: standardSettings,
              complianceStatus: isCompliant ? "Compliant" : "Non-Compliant",
              complianceDetails: standardInfo?.docsDescription || standardInfo?.helpText || "",
              standardDescription: standardInfo?.helpText || "",
              standardImpact: standardInfo?.impact || "Medium Impact",
              standardImpactColour: standardInfo?.impactColour || "warning",
              templateName: selectedTemplate.templateName || "Standard Template",
              templateActions: standardConfig.action || [],
            });
          });
        }

        setComparisonData(allStandards);
      } else {
        setComparisonData([]);
      }
    } else if (comparisonApi.isError) {
      setComparisonData([]);
    }
  }, [
    templateId,
    templateDetails.isSuccess,
    templateDetails.data,
    comparisonApi.isSuccess,
    comparisonApi.data,
    comparisonApi.isError,
  ]);
  const comparisonModeOptions = [{ label: "Compare Tenant to Standard", value: "standard" }];

  return (
    <Box sx={{ flexGrow: 1, py: 4 }}>
      <Stack spacing={4} sx={{ px: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            color="inherit"
            onClick={() => router.back()}
            startIcon={
              <SvgIcon fontSize="small">
                <ArrowLeftIcon />
              </SvgIcon>
            }
          >
            Back to Templates
          </Button>
        </Stack>
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={4}
          sx={{ mb: 3 }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrow />}
            onClick={runReportDialog.handleOpen}
          >
            Run Report Once
          </Button>
        </Stack>

        {comparisonApi.isLoading && (
          <>
            {[1, 2, 3].map((item) => (
              <Grid container spacing={3} key={item} sx={{ mb: 4 }}>
                <Grid item size={12}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 2, px: 1 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Skeleton variant="circular" width={40} height={40} />
                      <Skeleton variant="text" width={200} height={32} />
                    </Stack>
                    <Skeleton variant="text" width={100} height={24} />
                  </Stack>
                </Grid>

                <Grid item size={6}>
                  <Card sx={{ height: "100%" }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ p: 3 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={3}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <Stack>
                          <Skeleton variant="text" width={150} height={32} />
                          <Skeleton variant="text" width={120} height={24} sx={{ mt: 1 }} />
                        </Stack>
                      </Stack>
                    </Stack>
                    <Divider />
                    <Box sx={{ p: 3 }}>
                      <Skeleton variant="text" width="100%" height={20} />
                      <Skeleton variant="text" width="90%" height={20} />
                      <Skeleton variant="text" width="95%" height={20} />
                    </Box>
                  </Card>
                </Grid>

                <Grid item size={6}>
                  <Card sx={{ height: "100%" }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ p: 3 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={3}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <Stack>
                          <Skeleton variant="text" width={150} height={32} />
                          <Skeleton variant="text" width={120} height={24} sx={{ mt: 1 }} />
                        </Stack>
                      </Stack>
                    </Stack>
                    <Divider />
                    <Box sx={{ p: 3 }}>
                      <Skeleton variant="text" width="100%" height={20} />
                      <Skeleton variant="text" width="85%" height={20} />
                      <Skeleton variant="text" width="90%" height={20} />
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            ))}
          </>
        )}

        <Typography variant="h6" sx={{ mb: 3, px: 1 }}>
          Comparison Results
        </Typography>

        {comparisonApi.isError && (
          <Card sx={{ mb: 4, p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              Error fetching comparison data
            </Alert>
            <Typography variant="body2">
              There was an error retrieving the comparison data. Please try running the report again
              by clicking the "Run Report Once" button above.
            </Typography>
            {comparisonApi.error && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: "background.default",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="caption" component="pre" sx={{ whiteSpace: "pre-wrap" }}>
                  {comparisonApi.error.message || JSON.stringify(comparisonApi.error, null, 2)}
                </Typography>
              </Box>
            )}
          </Card>
        )}

        {comparisonApi.isSuccess && (!comparisonApi.data || comparisonApi.data.length === 0) && (
          <Card sx={{ mb: 4, p: 3, borderRadius: 2, boxShadow: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              No comparison data is available. This might be because:
            </Alert>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • The tenant has not been scanned yet
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • The template has no standards configured
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                • There was an issue with the comparison
              </Typography>
            </Box>
            <Typography variant="body2">
              Try running the report by clicking the "Run Report Once" button above.
            </Typography>
          </Card>
        )}

        {comparisonData &&
          comparisonData.length > 0 &&
          comparisonData.map((standard, index) => (
            <Grid container spacing={3} key={index} sx={{ mb: 4 }}>
              <Grid item size={6}>
                <Card sx={{ height: "100%", borderRadius: 2, boxShadow: 2 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 3 }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <Stack direction="row" alignItems="center" spacing={3}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor:
                              standard.complianceStatus === "Compliant"
                                ? "success.main"
                                : "error.main",
                          }}
                        >
                          {standard.complianceStatus === "Compliant" ? (
                            <CheckCircle sx={{ color: "white" }} />
                          ) : (
                            <Cancel sx={{ color: "white" }} />
                          )}
                        </Box>
                        <Stack>
                          <Typography variant="h6">{standard?.standardName}</Typography>
                          <Chip
                            label="Standard"
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ mt: 1 }}
                          />
                        </Stack>
                      </Stack>
                    </Stack>
                  </Stack>
                  <Divider />
                  <Box sx={{ p: 3 }}>
                    {!standard.standardValue ? (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        This data has not yet been collected. Collect the data by pressing the
                        report button on the top of the page.
                      </Alert>
                    ) : (
                      <Box>
                        <Box>
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: "background.default",
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            {standard.standardValue &&
                            typeof standard.standardValue === "object" &&
                            Object.keys(standard.standardValue).length > 0 ? (
                              Object.entries(standard.standardValue).map(([key, value]) => (
                                <Box key={key} sx={{ display: "flex", mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: "medium", mr: 1 }}>
                                    {key}:
                                  </Typography>
                                  <Typography variant="body2">
                                    {typeof value === "object" && value !== null
                                      ? (value.label || JSON.stringify(value))
                                      : value === true
                                      ? "Enabled"
                                      : value === false
                                      ? "Disabled"
                                      : String(value)}
                                  </Typography>
                                </Box>
                              ))
                            ) : (
                              <Typography variant="body2">
                                {standard.standardValue !== undefined
                                  ? typeof standard.standardValue === "object"
                                    ? "No settings configured"
                                    : String(standard.standardValue)
                                  : "Not configured"}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ mt: 2, display: "flex", alignItems: "center" }}>
                      <Chip
                        label={standard.standardImpact || "Medium Impact"}
                        size="small"
                        color={
                          standard.standardImpactColour === "info"
                            ? "info"
                            : standard.standardImpactColour === "warning"
                            ? "warning"
                            : "error"
                        }
                        sx={{ mr: 1 }}
                      />
                    </Box>
                  </Box>
                </Card>
              </Grid>

              <Grid item size={6}>
                <Card sx={{ height: "100%", borderRadius: 2, boxShadow: 2 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 3 }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <Stack direction="row" alignItems="center" spacing={3}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "primary.main",
                          }}
                        >
                          <Microsoft sx={{ color: "white" }} />
                        </Box>
                        <Stack>
                          <Typography variant="h6">{currentTenant}</Typography>
                          <Chip
                            label="Current Tenant"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ mt: 1 }}
                          />
                        </Stack>
                      </Stack>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Box
                          sx={{
                            backgroundColor:
                              standard.complianceStatus === "Compliant"
                                ? "success.main"
                                : "error.main",
                            borderRadius: "50%",
                            width: 8,
                            height: 8,
                            mr: 1,
                          }}
                        />
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {standard.complianceStatus}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                  <Divider />
                  <Box sx={{ p: 3 }}>
                    {typeof standard.currentTenantValue === "object" &&
                    standard.currentTenantValue !== null ? (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "background.default",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        {Object.entries(standard.currentTenantValue).map(([key, value]) => {
                          const standardValueForKey =
                            standard.standardValue && typeof standard.standardValue === "object"
                              ? standard.standardValue[key]
                              : undefined;

                          const isDifferent =
                            standardValueForKey !== undefined &&
                            JSON.stringify(value) !== JSON.stringify(standardValueForKey);

                          return (
                            <Box key={key} sx={{ display: "flex", mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: "medium", mr: 1 }}>
                                {key}:
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: standard.complianceStatus === "Compliant"
                                    ? "success.main"
                                    : (isDifferent ? "error.main" : "inherit"),
                                  fontWeight: standard.complianceStatus !== "Compliant" && isDifferent
                                    ? "medium"
                                    : "inherit",
                                }}
                              >
                                {standard.complianceStatus === "Compliant" && value === true
                                  ? "Compliant"
                                  : (typeof value === "object" && value !== null
                                      ? (value.label || JSON.stringify(value))
                                      : value === true
                                      ? "Enabled"
                                      : value === false
                                      ? "Disabled"
                                      : String(value))}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography
                        variant="body1"
                        sx={{
                          whiteSpace: "pre-wrap",
                          color:
                            standard.complianceStatus === "Compliant"
                              ? "success.main"
                              : "error.main",
                          fontWeight:
                            standard.complianceStatus !== "Compliant"
                              ? "medium"
                              : "inherit",
                        }}
                      >
                        {standard.complianceStatus === "Compliant" && standard.currentTenantValue === true
                          ? "Compliant"
                          : (standard.currentTenantValue !== undefined
                              ? String(standard.currentTenantValue)
                              : "Not configured")}
                      </Typography>
                    )}
                  </Box>
                </Card>
              </Grid>

              {standard.complianceDetails && (
                <Grid item size={12}>
                  <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
                    <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ p: 3 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "info.main",
                        }}
                      >
                        <Info />
                      </Box>
                      <Typography variant="body2">{standard.complianceDetails}</Typography>
                    </Stack>
                  </Card>
                </Grid>
              )}
            </Grid>
          ))}
      </Stack>

      <CippApiDialog
        createDialog={runReportDialog}
        title="Run Standard Report"
        api={{
          ...runReportApi,
          data: {
            ...runReportApi.data,
            TemplateId: templateId,
          },
        }}
        relatedQueryKeys={["ListStandardsCompare"]}
      />
    </Box>
  );
};

Page.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

export default Page;
