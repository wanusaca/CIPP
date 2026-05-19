import { useMemo } from "react";
import Head from "next/head";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  Memory,
  Speed,
  PlayArrow,
  HourglassEmpty,
  CheckCircle,
  Warning,
  Cancel,
  Delete,
  LowPriority,
  DeleteSweep,
} from "@mui/icons-material";
import { Grid } from "@mui/system";
import { Layout as DashboardLayout } from "../../../layouts/index.js";
import { CippInfoBar } from "../../../components/CippCards/CippInfoBar";
import { CippPropertyListCard } from "../../../components/CippCards/CippPropertyListCard";
import { CippDataTable } from "../../../components/CippTable/CippDataTable";
import { ApiGetCall, ApiPostCall } from "../../../api/ApiCall";

const formatDuration = (ms) => {
  if (ms === 0 || ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const formatUptime = (seconds) => {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const WorkerStatusChip = ({ isBusy, currentFunction }) => {
  if (isBusy) {
    return (
      <Chip
        label={currentFunction || "Busy"}
        color="warning"
        size="small"
        icon={<PlayArrow />}
        sx={{ maxWidth: 200 }}
      />
    );
  }
  return <Chip label="Idle" color="success" size="small" icon={<CheckCircle />} />;
};

const UtilizationBar = ({ value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    <Box sx={{ flexGrow: 1 }}>
      <LinearProgress
        variant="determinate"
        value={Math.min(value, 100)}
        color={value > 80 ? "error" : value > 50 ? "warning" : "primary"}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
    <Typography variant="body2" sx={{ minWidth: 45 }}>
      {value}%
    </Typography>
  </Box>
);

const WorkerTable = ({ workers, title }) => {
  if (!workers || workers.length === 0) return null;

  return (
    <Card sx={{ width: "100%", height: "100%" }}>
      <CardHeader title={title} titleTypographyProps={{ variant: "h6" }} />
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Worker</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Invocations</TableCell>
                <TableCell align="right">Utilization</TableCell>
                <TableCell align="right">Avg</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Max</TableCell>
                <TableCell align="right">Last</TableCell>
                <TableCell align="right">Faults</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workers.map((w) => (
                <TableRow key={w.WorkerId}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      W{w.WorkerId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <WorkerStatusChip isBusy={w.IsBusy} currentFunction={w.CurrentFunction} />
                  </TableCell>
                  <TableCell align="right">{w.TotalInvocations?.toLocaleString() ?? 0}</TableCell>
                  <TableCell align="right">
                    <UtilizationBar value={w.UtilizationPct ?? 0} />
                  </TableCell>
                  <TableCell align="right">{formatDuration(w.AvgDurationMs)}</TableCell>
                  <TableCell align="right">{formatDuration(w.MinDurationMs)}</TableCell>
                  <TableCell align="right">{formatDuration(w.MaxDurationMs)}</TableCell>
                  <TableCell align="right">{formatDuration(w.LastDurationMs)}</TableCell>
                  <TableCell align="right">
                    {w.TotalFaults > 0 ? (
                      <Chip label={w.TotalFaults} color="error" size="small" />
                    ) : (
                      "0"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

const Page = () => {
  const healthQuery = ApiGetCall({
    url: "/api/ListWorkerHealth",
    data: { Action: "Snapshot" },
    queryKey: "WorkerHealth",
    refetchInterval: 5000,
  });

  const jobAction = ApiPostCall({
    relatedQueryKeys: ["WorkerHealthJobs", "WorkerHealth"],
  });

  const snapshot = healthQuery.data?.Results;

  const infoBarData = useMemo(() => {
    if (!snapshot) return [];
    const http = snapshot.HttpPool || {};
    const bg = snapshot.BgPool || {};
    const jobs = snapshot.Jobs || {};
    const limiter = snapshot.Limiter || {};

    return [
      {
        icon: <Memory />,
        name: "HTTP Workers",
        data: `${http.BusyCount ?? 0} / ${http.PoolSize ?? 0} busy`,
        color: http.BusyCount >= http.PoolSize ? "error" : "primary",
      },
      {
        icon: <Speed />,
        name: "BG Workers",
        data: `${bg.BusyCount ?? 0} / ${bg.PoolSize ?? 0} busy`,
        color: bg.BusyCount >= bg.PoolSize ? "error" : "primary",
      },
      {
        icon: jobs.Running > 0 ? <PlayArrow /> : <HourglassEmpty />,
        name: "Job Queue",
        data: `${jobs.Running ?? 0} running, ${jobs.Queued ?? 0} queued`,
        color: jobs.Queued > 10 ? "warning" : "primary",
      },
      {
        icon: limiter.IsHttpThrottled ? <Warning /> : <CheckCircle />,
        name: "BG Limiter",
        data: limiter.IsHttpThrottled
          ? "HTTP Throttled"
          : `${limiter.Active ?? 0} / ${limiter.CurrentMax ?? 0} active`,
        color: limiter.IsHttpThrottled ? "error" : "primary",
      },
    ];
  }, [snapshot]);

  const httpPoolItems = useMemo(() => {
    if (!snapshot?.HttpPool) return [];
    const p = snapshot.HttpPool;
    return [
      { label: "Pool Size", value: p.PoolSize },
      { label: "Available", value: p.Available },
      { label: "Busy", value: p.BusyCount },
      { label: "Total Invocations", value: p.TotalInvocations?.toLocaleString() ?? 0 },
      { label: "Total Busy Time", value: formatDuration(p.TotalBusyMs) },
      { label: "Avg Utilization", value: `${p.AvgUtilizationPct ?? 0}%` },
      { label: "Avg Duration", value: formatDuration(p.AvgDurationMs) },
      { label: "Total Faults", value: p.TotalFaults ?? 0 },
    ];
  }, [snapshot]);

  const bgPoolItems = useMemo(() => {
    if (!snapshot?.BgPool) return [];
    const p = snapshot.BgPool;
    return [
      { label: "Pool Size", value: p.PoolSize },
      { label: "Available", value: p.Available },
      { label: "Busy", value: p.BusyCount },
      { label: "Total Invocations", value: p.TotalInvocations?.toLocaleString() ?? 0 },
      { label: "Total Busy Time", value: formatDuration(p.TotalBusyMs) },
      { label: "Avg Utilization", value: `${p.AvgUtilizationPct ?? 0}%` },
      { label: "Avg Duration", value: formatDuration(p.AvgDurationMs) },
      { label: "Total Faults", value: p.TotalFaults ?? 0 },
    ];
  }, [snapshot]);

  const limiterItems = useMemo(() => {
    if (!snapshot?.Limiter) return [];
    const l = snapshot.Limiter;
    return [
      { label: "Base Concurrency", value: l.BaseConcurrency },
      { label: "Ceiling Concurrency", value: l.CeilingConcurrency },
      { label: "Current Max", value: l.CurrentMax },
      { label: "Active", value: l.Active },
      { label: "Waiting", value: l.Waiting },
      {
        label: "HTTP Throttled",
        value: l.IsHttpThrottled ? "Yes" : "No",
      },
    ];
  }, [snapshot]);

  const jobItems = useMemo(() => {
    if (!snapshot?.Jobs) return [];
    const j = snapshot.Jobs;
    return [
      { label: "Running", value: j.Running },
      { label: "Queued", value: j.Queued },
      { label: "Completed", value: j.Completed?.toLocaleString() ?? 0 },
      { label: "Failed", value: j.Failed },
      { label: "Total Processed", value: j.TotalProcessed?.toLocaleString() ?? 0 },
      { label: "Max Concurrency", value: j.MaxConcurrency },
      { label: "Active Concurrency", value: j.ActiveConcurrency },
    ];
  }, [snapshot]);

  const jobSimpleColumns = ["Name", "RunName", "Priority", "Status", "WaitSeconds", "DurationSeconds"];

  const jobActions = useMemo(
    () => [
      {
        label: "Cancel Job",
        icon: <Cancel />,
        color: "error.main",
        noConfirm: true,
        customFunction: (row) => {
          jobAction.mutate({
            url: "/api/ListWorkerHealth",
            data: { Action: "CancelJob", JobId: row.Id },
          });
        },
        condition: (row) => row.Status === "Queued",
      },
      {
        label: "Change Priority",
        icon: <LowPriority />,
        fields: [
          {
            type: "textField",
            name: "Priority",
            label: "New Priority (0 = highest)",
          },
        ],
        url: "/api/ListWorkerHealth",
        data: { Action: "ChangePriority" },
        dataFunction: (row, formData) => ({
          Action: "ChangePriority",
          JobId: row.Id,
          Priority: parseInt(formData.Priority, 10),
        }),
        confirmText: "Change",
        condition: (row) => row.Status === "Queued",
        relatedQueryKeys: ["WorkerHealthJobs", "WorkerHealth"],
      },
      {
        label: "Cancel Run",
        icon: <Cancel />,
        color: "error.main",
        noConfirm: true,
        customFunction: (row) => {
          if (row.RunName) {
            jobAction.mutate({
              url: "/api/ListWorkerHealth",
              data: { Action: "CancelRun", RunName: row.RunName },
            });
          }
        },
        condition: (row) => row.Status === "Queued" && row.RunName,
      },
      {
        label: "Delete",
        icon: <Delete />,
        noConfirm: true,
        customFunction: (row) => {
          jobAction.mutate({
            url: "/api/ListWorkerHealth",
            data: { Action: "DeleteJob", JobId: row.Id },
          });
        },
        condition: (row) => row.Status !== "Queued" && row.Status !== "Running",
      },
    ],
    [jobAction]
  );

  const jobFilters = useMemo(
    () => [
      {
        filterName: "Queued",
        value: [{ id: "Status", value: "Queued" }],
      },
      {
        filterName: "Running",
        value: [{ id: "Status", value: "Running" }],
      },
      {
        filterName: "Failed",
        value: [{ id: "Status", value: "Failed" }],
      },
    ],
    []
  );

  return (
    <>
      <Head>
        <title>Worker Health | CIPP</title>
      </Head>
      <Box sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth="xl">
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h4">Worker Health</Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                {healthQuery.isFetching && <CircularProgress size={18} />}
                {snapshot && (
                  <Typography variant="body2" color="text.secondary">
                    Uptime: {formatUptime(snapshot.UptimeSeconds)} | Auto-refreshing every 5s
                  </Typography>
                )}
              </Stack>
            </Stack>

            <CippInfoBar isFetching={false} data={infoBarData} />

            <Grid container spacing={2}>
              <Grid size={{ lg: 6, md: 6, sm: 12, xs: 12 }}>
                <CippPropertyListCard
                  title="HTTP Pool"
                  propertyItems={httpPoolItems}
                  isFetching={false}
                  layout="two"
                />
              </Grid>
              <Grid size={{ lg: 6, md: 6, sm: 12, xs: 12 }}>
                <CippPropertyListCard
                  title="Background Pool"
                  propertyItems={bgPoolItems}
                  isFetching={false}
                  layout="two"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ lg: 6, md: 6, sm: 12, xs: 12 }}>
                <CippPropertyListCard
                  title="Background Task Limiter"
                  propertyItems={limiterItems}
                  isFetching={false}
                />
              </Grid>
              <Grid size={{ lg: 6, md: 6, sm: 12, xs: 12 }}>
                <CippPropertyListCard
                  title="Job Manager"
                  propertyItems={jobItems}
                  isFetching={false}
                  layout="two"
                />
              </Grid>
            </Grid>

            <WorkerTable workers={snapshot?.HttpPool?.Workers} title="HTTP Workers" />
            <WorkerTable workers={snapshot?.BgPool?.Workers} title="Background Workers" />

            <CippDataTable
              title="Job Queue"
              queryKey="WorkerHealthJobs"
              api={{
                url: "/api/ListWorkerHealth",
                data: { Action: "Jobs", Limit: "500" },
                dataKey: "Results",
              }}
              simpleColumns={jobSimpleColumns}
              actions={jobActions}
              filters={jobFilters}
              defaultSorting={[{ id: "Priority", desc: false }]}
              cardButton={
                <Button
                  size="small"
                  startIcon={<DeleteSweep />}
                  color="warning"
                  onClick={() =>
                    jobAction.mutate({
                      url: "/api/ListWorkerHealth",
                      data: { Action: "PurgeCompleted" },
                    })
                  }
                >
                  Purge Completed
                </Button>
              }
            />
          </Stack>
        </Container>
      </Box>
    </>
  );
};

Page.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;

export default Page;
