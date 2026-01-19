import { useParams } from 'react-router-dom';

export default function RollbackDetail() {
  const { id } = useParams();

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Rollback Detail</h3>
        <p className="text-sm text-gray-600 mt-1">Rollback ID: {id}</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold mb-4">Blast Radius</h4>
          <p className="text-gray-500">Blast radius visualization will be shown here</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold mb-4">Compensation Plan</h4>
          <p className="text-gray-500">List of compensations to execute will be shown here</p>
        </div>
      </div>
    </div>
  );
}
