import DashboardLayout from '../dashboard/layout';
import AnalyticsChart from '../../components/ui/analytics-chart';
import Card from '../../components/ui/card';

const AnalyticsPage = () => {
  const sampleData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 700 },
  ];

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Analytics</h1>
      <Card>
        <h2 className="text-lg font-semibold mb-4">Sample Analytics Chart</h2>
        <AnalyticsChart
          data={sampleData}
          type="line"
          dataKey="value"
          xAxisKey="name"
          lineColor="#8884d8"
        />
      </Card>
    </DashboardLayout>
  );
};

export default AnalyticsPage;